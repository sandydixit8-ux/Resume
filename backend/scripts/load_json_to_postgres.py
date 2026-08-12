"""Load migrated JSON data into the target database (PostgreSQL via app models).

Reads the data.json produced by migrate_sqlite_to_postgres.py and inserts rows
using the app's SQLAlchemy models, so column mapping and JSON (de)serialization
stay in sync with the code.

Usage:
  alembic upgrade head                    # create schema on the new DB first
  python scripts/load_json_to_postgres.py --data out/data.json

Set DATABASE_URL to the target Postgres/Supabase URL before running.

WARNING: this is a one-way migration. Run against an empty target database.
"""

import argparse
import json
import datetime
from pathlib import Path

from app.database import SessionLocal
from app.models.admin import VisitorLog, AdminSetting
from app.models.analysis import Analysis, JDAnalysis, CoverLetter
from app.models.contact import ContactMessage
from app.models.payment import Subscription
from app.models.resume import Resume

MODELS = {
    "admin_settings": AdminSetting,
    "contact_messages": ContactMessage,
    "resumes": Resume,
    "subscriptions": Subscription,
    "visitor_logs": VisitorLog,
    "analyses": Analysis,
    "jd_analyses": JDAnalysis,
    "cover_letters": CoverLetter,
}


def _parse(value):
    if value is None:
        return None
    if isinstance(value, str) and len(value) >= 19 and "T" in value:
        try:
            return datetime.datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return value
    return value


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", default="out/data.json")
    args = parser.parse_args()

    with open(args.data, encoding="utf-8") as f:
        dump = json.load(f)

    db = SessionLocal()
    try:
        for table in MODELS:
            rows = dump.get(table, [])
            if not rows:
                print(f"  {table}: skipped (0 rows)")
                continue
            model = MODELS[table]
            for row in rows:
                kwargs = {}
                for col, value in row.items():
                    if col not in {c.name for c in model.__table__.columns}:
                        continue
                    if col.endswith("_json") or col in {
                        "category_scores", "category_feedback", "priority_fixes",
                        "matched_keywords", "missing_keywords", "hard_requirements",
                        "nice_to_have", "semantic_gaps", "over_indexed", "raw_extracted",
                        "parsing_issues",
                    }:
                        kwargs[col] = json.dumps(value) if value is not None else None
                    elif isinstance(value, dict) or isinstance(value, list):
                        kwargs[col] = json.dumps(value)
                    else:
                        kwargs[col] = _parse(value)
                db.add(model(**kwargs))
            db.commit()
            print(f"  {table}: inserted {len(rows)} rows")
        _reset_sequences(db)
        print("Done. Foreign keys follow SQLite row ids (1:1).")
    finally:
        db.close()


def _reset_sequences(db) -> None:
    """Bump Postgres identity sequences past the migrated max ids."""
    from sqlalchemy import text
    from app.database import engine

    if not engine.dialect.name == "postgresql":
        return
    for table in MODELS:
        with engine.begin() as conn:
            result = conn.execute(text(f"SELECT COALESCE(MAX(id), 0) FROM {table}"))
            max_id = result.scalar()
            if max_id:
                conn.execute(
                    text(f"SELECT setval(pg_get_serial_sequence('{table}', 'id'), :max)")
                    .bindparams(max=max_id)
                )
    print("  sequences reset for PostgreSQL identity columns")


if __name__ == "__main__":
    main()
