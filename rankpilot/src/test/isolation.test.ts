import { describe, expect, it } from "vitest";
import { getDb } from "@/lib/db/db";
import { mkdtempSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

/**
 * Guards the test-database isolation itself.
 *
 * Every other suite silently assumed it was running against a scratch file.
 * That assumption was false for a long time: the suite opened
 * `data/rankpilot.db`, the developer's real working database, and left test rows
 * in it. These assertions fail if isolation is ever removed, so the leak cannot
 * come back quietly.
 */
describe("test database isolation", () => {
  it("points the connection at the scratch directory, not the repo database", () => {
    const path = process.env.RANKPILOT_DB_PATH ?? "";
    expect(path).toBeTruthy();

    const repoDb = resolve("data/rankpilot.db");
    expect(resolve(path)).not.toBe(repoDb);

    // Must live under the OS temp directory.
    expect(resolve(path).startsWith(resolve(tmpdir()))).toBe(true);
  });

  it("opens a real, migrated database rather than a stub", () => {
    const tables = getDb()
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all() as Array<{ name: string }>;
    const names = tables.map((t) => t.name);
    expect(names).toContain("organizations");
    expect(names).toContain("users");
    expect(names).toContain("audit_logs");
  });

  it("does not leave rows in the repository database", () => {
    const repoDb = resolve("data/rankpilot.db");
    if (!existsSync(repoDb)) return; // No dev database on this machine; nothing to assert.
    const before = readFileSync(repoDb);
    getDb().exec("CREATE TABLE IF NOT EXISTS isolation_probe (id INTEGER PRIMARY KEY)");
    getDb().exec("INSERT INTO isolation_probe (id) VALUES (1)");
    expect(readFileSync(repoDb).equals(before)).toBe(true);
  });

  it("shares no file with the database another worker would get", () => {
    const worker = process.env.VITEST_WORKER_ID ?? process.env.VITEST_POOL_ID ?? "1";
    const expected = join(process.env.RANKPILOT_TEST_DIR ?? tmpdir(), `worker-${worker}.db`);
    // Files that claim a dedicated database opt out of the per-worker default.
    const dedicated = /-(tenancy|analyze|ai|lease|xtenant)-/.test(process.env.RANKPILOT_DB_PATH ?? "");
    if (!dedicated) expect(process.env.RANKPILOT_DB_PATH).toBe(expected);
  });

  it("keeps dedicated databases inside the scratch directory too", () => {
    // A suite that calls mkdtempSync itself leaks a directory per run. These
    // prefixes are the dedicated-database files; all must sit under the run dir.
    const path = process.env.RANKPILOT_DB_PATH ?? "";
    const dedicated = /-(tenancy|analyze|ai|lease|xtenant)-/.test(path);
    if (!dedicated) return;
    expect(resolve(path).startsWith(resolve(process.env.RANKPILOT_TEST_DIR ?? tmpdir()))).toBe(true);
  });
});
