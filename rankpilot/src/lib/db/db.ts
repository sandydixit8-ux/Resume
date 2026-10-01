import { DatabaseSync } from "node:sqlite";
import { readFileSync, mkdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { randomUUID, randomBytes } from "node:crypto";

let _db: DatabaseSync | null = null;

/**
 * The one rule for where the database lives.
 *
 * This used to be written out four times -- in `getDb`, in the deploy
 * preflight, in the backup script, and implicitly in the init script -- kept in
 * agreement only by a comment asking people to keep it in sync. That is how the
 * backup script once ended up backing up a different file than the application
 * was writing, so the copies are now one exported function. Anything that needs
 * the path must call this rather than re-deriving it.
 */
export function databasePath(env: Record<string, string | undefined> = process.env): string {
  return resolve(env.RANKPILOT_DB_PATH || env.DATABASE_PATH || "data/rankpilot.db");
}

/**
 * The explicit override, or undefined when the caller is relying on the local
 * default. Exposed so callers can ask "was a path configured?" without
 * re-deriving the precedence order.
 */
export function databasePathOverride(
  env: Record<string, string | undefined> = process.env
): string | undefined {
  return env.RANKPILOT_DB_PATH?.trim() || env.DATABASE_PATH?.trim() || undefined;
}

export function getDb(): DatabaseSync {
  if (_db) return _db;
  const path = databasePath();
  mkdirSync(dirname(path), { recursive: true });

  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA busy_timeout = 5000");
  migrate(db);
  _db = db;
  return db;
}

export function migrate(db: DatabaseSync) {
  const schema = readFileSync(
    join(process.cwd(), "src", "lib", "db", "schema.sql"),
    "utf8"
  );
  db.exec(schema);
  runMigrations(db);
}

/** Ordered, idempotent migrations for database files created before a schema change. */
const MIGRATIONS: Array<{ id: number; up: (db: DatabaseSync) => void }> = [
  {
    id: 1,
    up: (db) =>
      addColumn(db, "pages", "inbound_link_count", "INTEGER NOT NULL DEFAULT 0"),
  },
  {
    id: 2,
    up: (db) => addColumn(db, "websites", "client_id", "TEXT"),
  },
  {
    id: 3,
    up: (db) => addColumn(db, "websites", "crawl_schedule", "TEXT"),
  },
  {
    // Retention deadline for the free audit's email/IP. Existing rows get a
    // deadline relative to their creation, so nothing becomes undeletable.
    id: 4,
    up: (db) => {
      addColumn(db, "free_audits", "expires_at", "TEXT");
      db.exec("CREATE INDEX IF NOT EXISTS idx_free_audits_expires ON free_audits(expires_at)");
      db.exec(
        `UPDATE free_audits SET expires_at = datetime(created_at, '+' || $days || ' days')
         WHERE expires_at IS NULL`.replace("$days", String(FREE_AUDIT_RETENTION_DAYS))
      );
    },
  },
  {
    // The CMS auto-fix flow promises a backup before an apply. A bare
    // `backup_ref` string cannot be restored from, so the pre-change content
    // itself is stored: that is what makes a restore possible.
    id: 5,
    up: (db) => addColumn(db, "cms_fixes", "backup_content", "TEXT"),
  },
];

/**
 * Retention for anonymous free audits, which store an email address and an IP.
 * Configurable rather than hard-coded because it is a policy decision, not a
 * technical one. Defaults to 30 days.
 */
export const FREE_AUDIT_RETENTION_DAYS = Number(process.env.FREE_AUDIT_RETENTION_DAYS || 30);

function addColumn(db: DatabaseSync, table: string, column: string, ddl: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as unknown as {
    name: string;
  }[];
  if (cols.some((c) => c.name === column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
}

function runMigrations(db: DatabaseSync) {
  db.exec(
    "CREATE TABLE IF NOT EXISTS _migrations (id INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)"
  );
  const applied = new Set(
    (
      db.prepare("SELECT id FROM _migrations").all() as unknown as { id: number }[]
    ).map((r) => r.id)
  );
  for (const m of MIGRATIONS) {
    if (applied.has(m.id)) continue;
    db.exec("BEGIN");
    try {
      m.up(db);
      db.prepare("INSERT INTO _migrations (id, applied_at) VALUES (?, ?)").run(
        m.id,
        new Date().toISOString()
      );
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  }
}

export type Row = Record<string, unknown>;

export type SQLParam = string | number | bigint | null | Uint8Array;

export function all<T = Row>(sql: string, ...params: SQLParam[]): T[] {
  return getDb()
    .prepare(sql)
    .all(...params)
    .map((r) => toPlain(r)) as unknown as T[];
}

export function row<T = Row>(sql: string, ...params: SQLParam[]): T | undefined {
  const r = getDb().prepare(sql).get(...params);
  return (r === undefined ? r : toPlain(r)) as unknown as T | undefined;
}

/** node:sqlite returns null-prototype objects; convert so they can cross the RSC boundary. */
function toPlain<T>(v: T): T {
  if (Array.isArray(v)) return v.map((x) => toPlain(x)) as unknown as T;
  if (v && typeof v === "object" && !(v instanceof Uint8Array)) {
    return { ...(v as Record<string, unknown>) } as T;
  }
  return v;
}

export function run(
  sql: string,
  ...params: SQLParam[]
): { changes: number; lastInsertRowid: number | bigint } {
  const stmt = getDb().prepare(sql);
  const info = stmt.run(...params);
  return { changes: Number(info.changes), lastInsertRowid: Number(info.lastInsertRowid) };
}

export function tx<T>(fn: () => T): T {
  const db = getDb();
  db.exec("BEGIN");
  try {
    const out = fn();
    db.exec("COMMIT");
    return out;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

export function newId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function nanoid(size = 12): string {
  return randomBytes(size).toString("base64url").slice(0, size);
}

export function closeDb() {
  _db?.close();
  _db = null;
}
