"""One-shot migration: SQLite dpiic.db -> PostgreSQL / Supabase.

Steps this script handles:
  1. Dumps every table from the SQLite DB to JSON (rows preserve column names).
  2. Rewrites resume.file_path entries to the basename only (portable keys).
  3. Writes a file manifest (upload/ in the local uploads dir -> storage key)
     so files can be re-uploaded to Supabase Storage.

What it does NOT do:
  - It does not write to Postgres (that is a separate load step using the
    dumped JSON via the app models, or psql COPY).
  - It does not upload files (use the manifest with the app's storage service).

Usage:
  python scripts/migrate_sqlite_to_postgres.py [--db backend/dpiic.db] [--out out/]

Example load into Postgres via SQLAlchemy (after alembic upgrade head):
  python scripts/load_json_to_postgres.py --data out/data.json

"""

import argparse
import json
import os
import sqlite3
from pathlib import Path

TABLES = [
    "admin_settings",
    "contact_messages",
    "resumes",
    "subscriptions",
    "visitor_logs",
    "analyses",
    "jd_analyses",
    "cover_letters",
]

# JSON columns that arrive as text from SQLite and must be re-parsed on load.
TEXT_JSON_COLUMNS = {
    "resumes": {"parsed_json", "parsing_issues"},
    "analyses": {"category_scores", "category_feedback", "priority_fixes"},
    "jd_analyses": {
        "matched_keywords", "missing_keywords", "hard_requirements",
        "nice_to_have", "semantic_gaps", "over_indexed", "raw_extracted",
    },
}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", default="dpiic.db", help="Path to the SQLite database file")
    parser.add_argument("--out", default="out", help="Output directory for data.json and files.json")
    parser.add_argument("--uploads", default="uploads", help="Local uploads directory")
    args = parser.parse_args()

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    con = sqlite3.connect(args.db)
    con.row_factory = sqlite3.Row
    cur = con.cursor()

    dump: dict[str, list[dict]] = {}
    for table in TABLES:
        cols = [c["name"] for c in cur.execute(f"PRAGMA table_info({table})")]
        rows = cur.execute(f"SELECT * FROM {table}").fetchall()
        table_rows = []
        for r in rows:
            row = {c: r[c] for c in cols}
            text_json = TEXT_JSON_COLUMNS.get(table, set())
            for col in text_json:
                if row.get(col) and isinstance(row[col], str):
                    try:
                        row[col] = json.loads(row[col])
                    except (ValueError, TypeError):
                        pass
            table_rows.append(row)
        dump[table] = table_rows
        print(f"  {table}: {len(table_rows)} rows")

    # Rewrite file paths to portable basenames.
    file_manifest = []
    uploads_dir = Path(args.uploads)
    for row in dump.get("resumes", []):
        fp = row.get("file_path")
        if not fp:
            continue
        base = Path(fp).name
        row["file_path"] = base
        source = uploads_dir / base
        file_manifest.append({
            "resume_id": row["id"],
            "original_filename": row.get("original_filename"),
            "key": base,
            "local_file": str(source) if source.exists() else None,
        })

    data_path = out_dir / "data.json"
    files_path = out_dir / "files.json"
    with open(data_path, "w", encoding="utf-8") as f:
        json.dump(dump, f, indent=2, ensure_ascii=False)
    with open(files_path, "w", encoding="utf-8") as f:
        json.dump(file_manifest, f, indent=2, ensure_ascii=False)

    missing = [m["key"] for m in file_manifest if not m["local_file"]]
    print(f"\nWrote {data_path} ({data_path.stat().st_size} bytes)")
    print(f"Wrote {files_path} with {len(file_manifest)} files ({len(missing)} missing on disk: {missing[:5]})")

    con.close()
    print("\nNext steps:")
    print("  1. alembic upgrade head  (against the new Postgres URL)")
    print("  2. python scripts/load_json_to_postgres.py --data out/data.json")
    print("  3. Upload files from files.json into Supabase Storage (key = 'resumes/<key>')")


if __name__ == "__main__":
    main()
