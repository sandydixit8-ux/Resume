import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * End-to-end protection for the backup command itself.
 *
 * The crypto unit tests cover `encrypt`/`decrypt` in isolation. They cannot catch
 * a regression in `scripts/backup.ts`, which is where the parts that actually
 * put a protected file on disk live: encrypting routine backups, deleting the
 * plaintext, and not leaving verification artifacts behind.
 *
 * Each test runs against a throwaway database and backup directory, so it never
 * touches the developer's real database or real snapshots.
 */

const root = process.cwd();
let work: string;
let dbPath: string;
let backupDir: string;


function env(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  return {
    ...process.env,
    RANKPILOT_DB_PATH: dbPath,
    RANKPILOT_BACKUP_DIR: backupDir,
    BACKUP_PASSPHRASE: "test-only-passphrase-not-a-real-secret",
    BACKUP_RETENTION_DAYS: "",
    BACKUP_STALE_HOURS: "",
    BACKUP_KEEP_VERIFY_SNAPSHOT: "",
    ...extra,
  };
}

function runScript(args: string[], extra: Record<string, string> = {}): string {
  return execFileSync(
    process.execPath,
    [join(root, "node_modules", "tsx", "dist", "cli.mjs"), join(root, "scripts", "backup.ts"), ...args],
    { cwd: root, env: env(extra), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
  );
}

/**
 * Runs the script and returns stdout and stderr together. `console.warn` goes to
 * stderr, so a test asserting on a warning has to read both or it asserts on
 * output that was never captured -- which passes or fails for the wrong reason.
 */
function runScriptBothStreams(args: string[], extra: Record<string, string> = {}): string {
  const result = spawnSync(
    process.execPath,
    [join(root, "node_modules", "tsx", "dist", "cli.mjs"), join(root, "scripts", "backup.ts"), ...args],
    { cwd: root, env: env(extra), encoding: "utf8" }
  );
  return `${result.stdout ?? ""}${result.stderr ?? ""}`;
}

function snapshots(): string[] {
  if (!existsSync(backupDir)) return [];
  return readdirSync(backupDir).filter((f) => f.startsWith("rankpilot-")).sort();
}

beforeAll(() => {
  work = mkdtempSync(join(tmpdir(), "backup-e2e-"));
  dbPath = join(work, "test.db");
  backupDir = join(work, "backups");

  // Belt and braces: this file must never be able to write to the real database,
  // because everything below asserts on what ends up on disk. `scripts/init-db.ts`
  // is deliberately not used to seed, as it ignores RANKPILOT_DB_PATH and always
  // targets data/rankpilot.db.
  if (!resolve(dbPath).startsWith(resolve(tmpdir()))) {
    throw new Error(`refusing to run: test database ${dbPath} is outside the temp directory`);
  }

  // A minimal database is enough. The behaviour under test lives in
  // scripts/backup.ts -- encrypting, deleting the plaintext, cleaning up after
  // verification -- and none of it depends on the application's schema. The
  // schema and migration correctness are covered by their own scripts.
  execFileSync(
    process.execPath,
    [
      "-e",
      `const {DatabaseSync}=require('node:sqlite');
       const d=new DatabaseSync(process.argv[1]);
       d.exec("CREATE TABLE probe (id INTEGER PRIMARY KEY, email TEXT, created_at TEXT)");
       d.prepare("INSERT INTO probe (email, created_at) VALUES (?,?)").run("leak-canary@example.com","2026-01-01");
       d.close();`,
      dbPath,
    ],
    { encoding: "utf8" }
  );
}, 180_000);

afterAll(() => {
  rmSync(work, { recursive: true, force: true });
});

describe("db:backup", () => {
  it("leaves ciphertext on disk and no plaintext snapshot", () => {
    const out = runScript([]);

    const files = snapshots();
    expect(files).toHaveLength(1);
    expect(files[0].endsWith(".db.enc")).toBe(true);
    // The plaintext must not survive next to the ciphertext. This is the
    // specific regression: the routine path originally encrypted only when
    // --verify was passed, so scheduled backups sat in plaintext.
    expect(readdirSync(backupDir).some((f) => f.endsWith(".db"))).toBe(false);
    expect(out).toContain("Encrypted with AES-256-GCM");
  });

  it("does not contain the row contents in the ciphertext", () => {
    // Proves the payload is really encrypted rather than merely renamed. The
    // canary address is readable in the plaintext database by construction.
    const file = snapshots()[0];
    const bytes = readFileSync(join(backupDir, file));
    expect(bytes.includes(Buffer.from("leak-canary@example.com"))).toBe(false);
    // RPKB1 magic header, so the file is a recognisable ciphertext, not garbage.
    expect(bytes.subarray(0, 5).toString()).toBe("RPKB1");
  });

  it("takes a second snapshot per run rather than overwriting the first", () => {
    runScript([]);
    expect(snapshots().length).toBe(2);
  });
});

describe("db:restore-test (--verify)", () => {
  it("verifies a restore without leaving a snapshot behind", () => {
    // This is the leak: CI runs db:restore-test on every commit, and each run
    // used to add a full encrypted copy of the database that nothing removed.
    // It is worse than disk growth -- those files are recent, so backup-status
    // would report backups as fresh even if the real scheduled job was dead.
    const before = snapshots().length;
    const out = runScript(["--verify"]);
    const after = snapshots().length;

    expect(out).toContain("RESTORE VERIFIED");
    expect(out).toContain("integrity_check: ok");
    expect(after).toBe(before);
    expect(readdirSync(backupDir).some((f) => f.startsWith("restore-check-"))).toBe(false);
  }, 180_000);

  it("keeps the snapshot when explicitly asked, proving the cleanup is what removes it", () => {
    const before = snapshots().length;
    runScript(["--verify"], { BACKUP_KEEP_VERIFY_SNAPSHOT: "1" });
    expect(snapshots().length).toBe(before + 1);
  }, 180_000);

  it("still rejects a wrong passphrase during verification", () => {
    const out = runScript(["--verify"]);
    expect(out).toContain("Wrong passphrase correctly rejected");
  }, 180_000);
});

describe("db:restore-test --verify-retained (aged snapshot read-back)", () => {
  // `--verify` restores a snapshot it has just taken, which proves the backup
  // code works but says nothing about the snapshots an operator would actually
  // restore from. Those are aged, and they are the only ones that exist if the
  // scheduled job has been failing silently. A green --verify on a fresh
  // snapshot is a misleading all-clear when the newest retained one is 40 days
  // old and unreadable.

  /**
   * Ages every snapshot in the directory, not just one. The script verifies
   * whichever is newest by mtime, so ageing a single file would leave the
   * ones this test did not touch looking fresh, and the aged path would never be
   * exercised.
   */
  function ageAllSnapshots(days: number): void {
    const files = snapshots();
    expect(files.length).toBeGreaterThan(0);
    const when = new Date(Date.now() - days * 86_400_000);
    for (const file of files) utimesSync(join(backupDir, file), when, when);
  }

  it("restores a snapshot that is days old, and reports its age", () => {
    ageAllSnapshots(9);

    const out = runScript(["--verify-retained"]);
    expect(out).toContain("RETAINED SNAPSHOT VERIFIED");
    expect(out).toContain("integrity_check: ok");
    // The age is stated, because "VERIFIED" on a 9-day-old file without that
    // context reads as "your backups are current". 216h is 9 days.
    expect(out).toMatch(/21[0-9]\.\d+h old/);
  }, 180_000);

  it("warns when the newest retained snapshot is older than the staleness limit", () => {
    // Not fatal: a stale snapshot can still be restorable, and refusing to check
    // it would bury the real problem, which is that the backup job has died.
    ageAllSnapshots(9);
    const out = runScriptBothStreams(["--verify-retained"], { BACKUP_STALE_HOURS: "1" });
    expect(out).toMatch(/WARNING[\s\S]*scheduled backup job has not run recently/);
    expect(out).toContain("RETAINED SNAPSHOT VERIFIED");
  }, 180_000);

  it("fails when the snapshot is encrypted and the passphrase is unavailable", () => {
    // The failure this exists to catch: an operator restores during an incident
    // and discovers the passphrase is not the one the snapshots were written
    // with, or is not in the environment at all.
    let failed = "";
    try {
      runScript(["--verify-retained"], { BACKUP_PASSPHRASE: "" });
    } catch (error) {
      failed = String((error as { stderr?: string }).stderr ?? "");
    }
    expect(failed).toContain("BACKUP_PASSPHRASE is not set");
  }, 180_000);

  it("fails loudly when the backup directory is empty, rather than reporting success", () => {
    // A backup job that has never run looks exactly like this.
    const empty = join(work, "empty-backups");
    mkdirSync(empty, { recursive: true });
    let failed = "";
    try {
      runScript(["--verify-retained"], { RANKPILOT_BACKUP_DIR: empty });
    } catch (error) {
      failed = String((error as { stderr?: string }).stderr ?? "");
    }
    expect(failed).toContain("no snapshots");
  }, 180_000);

  it("leaves no restore-check artifact behind", () => {
    runScript(["--verify-retained"]);
    expect(readdirSync(backupDir).some((f) => f.startsWith("restore-check-"))).toBe(false);
  }, 180_000);
});
