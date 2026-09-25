import { DatabaseSync } from "node:sqlite";
import { readFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { randomUUID, randomBytes } from "node:crypto";

let _db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (_db) return _db;
  const path = process.env.CREATOROS_DB_PATH || process.env.DATABASE_PATH || "data/creatoros.db";
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  migrate(db);
  _db = db;
  return db;
}

export function migrate(db: DatabaseSync) {
  const schema = readFileSync(join(process.cwd(), "src", "lib", "db", "schema.sql"), "utf8");
  db.exec(schema);
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

/** node:sqlite returns null-prototype objects; convert to plain objects so they can cross the RSC boundary. */
function toPlain<T>(v: T): T {
  if (Array.isArray(v)) return v.map((x) => toPlain(x)) as unknown as T;
  if (v && typeof v === "object" && !(v instanceof Uint8Array)) {
    return { ...(v as Record<string, unknown>) } as T;
  }
  return v;
}

export function run(sql: string, ...params: SQLParam[]): { changes: number; lastInsertRowid: number | bigint } {
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