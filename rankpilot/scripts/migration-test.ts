import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

/**
 * Migration test against a database created by an *older* schema.
 *
 * This exists because of a real bug: adding a column to schema.sql does
 * nothing for an existing database (`CREATE TABLE IF NOT EXISTS` is a no-op),
 * so an index on the new column breaks the upgrade path. Creating the table
 * here without `expires_at` and then running the real migration is the only way
 * to prove the upgrade works.
 *
 * Run with: npx tsx scripts/migration-test.ts
 */

function makeLegacyDb(dir: string): string {
  const path = join(dir, "legacy.db");
  const db = new DatabaseSync(path);
  // Deliberately the pre-retention shape of free_audits: no expires_at.
  db.exec(`
    CREATE TABLE free_audits (
      id TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      email TEXT,
      ip TEXT,
      score INTEGER,
      snapshot TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    );
    CREATE TABLE _migrations (id INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
    INSERT INTO _migrations (id, applied_at) VALUES (1, '2026-01-01T00:00:00.000Z');
    INSERT INTO _migrations (id, applied_at) VALUES (2, '2026-01-01T00:00:00.000Z');
    INSERT INTO _migrations (id, applied_at) VALUES (3, '2026-01-01T00:00:00.000Z');
  `);
  const now = new Date().toISOString();
  db.prepare(
    "INSERT INTO free_audits (id, url, email, ip, score, snapshot, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run("aud_old", "https://legacy.example", "old@example.com", "9.9.9.9", 40, "{}", now);
  db.close();
  return path;
}

async function main() {
  const dir = mkdtempSync(join(tmpdir(), "rankpilot-mig-"));
  const legacy = makeLegacyDb(dir);

  process.env.RANKPILOT_DB_PATH = legacy;
  // The db module resolves its path at first use, so this must be set before
  // the dynamic import triggers getDb().
  const { getDb, closeDb } = await import("../src/lib/db/db");
  getDb();

  const db = new DatabaseSync(legacy);
  const cols = (
    db.prepare("PRAGMA table_info(free_audits)").all() as unknown as { name: string }[]
  ).map((c) => c.name);
  const idx = db
    .prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='free_audits'")
    .all() as unknown as { name: string }[];
  const row = db.prepare("SELECT id, expires_at FROM free_audits WHERE id='aud_old'").get() as
    | { id: string; expires_at: string | null }
    | undefined;
  const applied = db.prepare("SELECT MAX(id) AS m FROM _migrations").get() as { m: number };
  db.close();
  closeDb();

  const checks: [string, boolean][] = [
    ["expires_at column added to a legacy table", cols.includes("expires_at")],
    ["retention index created", idx.some((i) => i.name === "idx_free_audits_expires")],
    ["pre-existing row backfilled, not left undeletable", Boolean(row?.expires_at)],
    ["migration recorded as applied", applied.m >= 4],
  ];

  console.log("Migration test: legacy database (no expires_at) -> current schema");
  for (const [label, ok] of checks) console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}`);
  console.log(`\n  backfilled deadline: ${row?.expires_at}`);

  rmSync(dir, { recursive: true, force: true });
  if (!existsSync(dir)) console.log("  scratch directory cleaned up");

  if (checks.some(([, ok]) => !ok)) {
    console.error("\nMIGRATION TEST FAILED");
    process.exit(1);
  }
  console.log("\nMIGRATION TEST PASSED");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
