import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  canDeploy,
  initDirectories,
  isMissingDirectoryBlocker,
  looksEphemeral,
  runDeployPreflight,
  resolveDataPaths,
} from "./deploy-preflight";
import { backupDirectory } from "./backup-status";
import { databasePath } from "./db/db";

/**
 * The preflight's job is to refuse a bad deploy. A test that only checks the
 * happy path proves nothing, so most of these assert that a specific dangerous
 * environment is actually blocked.
 */

let root: string;
let dbDir: string;
let backupDir: string;
let dbPath: string;

/** A production environment that passes everything. */
function goodEnv(extra: Record<string, string | undefined> = {}): Record<string, string | undefined> {
  return {
    NODE_ENV: "production",
    AUTH_SECRET: "a-real-production-secret-with-32-plus-chars-abcdefgh",
    RANKPILOT_DB_PATH: dbPath,
    RANKPILOT_BACKUP_DIR: backupDir,
    BACKUP_PASSPHRASE: "a-real-backup-passphrase",
    BACKUP_RETENTION_DAYS: "30",
    EMAIL_WEBHOOK_URL: "https://mail.example.com/hook",
    ...extra,
  };
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "preflight-"));
  dbDir = join(root, "data");
  backupDir = join(root, "backups");
  dbPath = join(dbDir, "rankpilot.db");
  mkdirSync(dbDir, { recursive: true });
  mkdirSync(backupDir, { recursive: true });
  writeFileSync(dbPath, "sqlite-ish");
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("runDeployPreflight", () => {
  it("passes a correctly configured production environment", () => {
    const result = runDeployPreflight(goodEnv());
    expect(result.blockers).toEqual([]);
    expect(canDeploy(result)).toBe(true);
  });

  it("blocks a missing AUTH_SECRET", () => {
    const result = runDeployPreflight(goodEnv({ AUTH_SECRET: "" }));
    expect(result.blockers.join(" ")).toMatch(/AUTH_SECRET is not set/);
  });

  it("blocks a placeholder AUTH_SECRET even when it is long enough", () => {
    const result = runDeployPreflight(goodEnv({ AUTH_SECRET: "change-me-to-something-real-abcdefghij" }));
    expect(result.blockers.join(" ")).toMatch(/placeholder/);
  });

  it("blocks an unset database path, which would be relative", () => {
    const env = goodEnv();
    delete env.RANKPILOT_DB_PATH;
    const result = runDeployPreflight(env);
    expect(result.blockers.join(" ")).toMatch(/RANKPILOT_DB_PATH is not set/);
  });

  it("blocks a relative database path", () => {
    const result = runDeployPreflight(goodEnv({ RANKPILOT_DB_PATH: "data/rankpilot.db" }));
    expect(result.blockers.join(" ")).toMatch(/is relative/);
  });

  it("blocks a database on an ephemeral path, the failure that loses everything", () => {
    // The realistic mistake: a platform that defaults the working directory to
    // /tmp. The app would run perfectly and lose the database on the next deploy.
    const result = runDeployPreflight(goodEnv({ RANKPILOT_DB_PATH: "/tmp/rankpilot/data/rankpilot.db" }));
    expect(result.blockers.join(" ")).toMatch(/ephemeral/);
  });

  it("blocks backups on an ephemeral path", () => {
    const result = runDeployPreflight(goodEnv({ RANKPILOT_BACKUP_DIR: "/tmp/rankpilot-backups" }));
    expect(result.blockers.join(" ")).toMatch(/ephemeral/);
  });

  it("detects ephemeral paths given in Windows form", () => {
    // Regression: the check normalised separators but not the drive letter, so
    // `C:\\tmp\\...` never matched `/tmp` and the one check designed to prevent
    // silent data loss did nothing on Windows.
    expect(looksEphemeral("C:\\tmp\\rankpilot\\rankpilot.db")).toBe(true);
    expect(looksEphemeral("C:/tmp/rankpilot/rankpilot.db")).toBe(true);
    expect(looksEphemeral("/var/task/app/data/rankpilot.db")).toBe(true);
  });

  it("does not mistake a persistent path for an ephemeral one", () => {
    // The failure mode of an over-eager check is just as bad: it blocks every
    // legitimate deploy until someone learns to bypass it. In particular the OS
    // temp directory on Windows lives under the user profile and is NOT wiped.
    expect(looksEphemeral("C:\\srv\\rankpilot\\data\\rankpilot.db")).toBe(false);
    expect(looksEphemeral("/srv/rankpilot/data/rankpilot.db")).toBe(false);
    expect(looksEphemeral("/mnt/volume/rankpilot.db")).toBe(false);
    expect(looksEphemeral("/data/rankpilot.db")).toBe(false);
    expect(looksEphemeral(join(tmpdir(), "rankpilot", "rankpilot.db"))).toBe(false);
  });

  it("blocks a database directory that does not exist", () => {
    const result = runDeployPreflight(
      goodEnv({ RANKPILOT_DB_PATH: join(root, "nope", "rankpilot.db") })
    );
    expect(result.blockers.join(" ")).toMatch(/Database directory is unusable/);
  });

  it("blocks plaintext backups unless explicitly allowed", () => {
    const env = goodEnv({ BACKUP_PASSPHRASE: "" });
    expect(runDeployPreflight(env).blockers.join(" ")).toMatch(/BACKUP_PASSPHRASE is not set/);

    // Opting out clears the blocker and nothing else. The database and email
    // requirements are independent, so a real production environment still passes.
    const allowed = runDeployPreflight(env, { allowPlaintextBackups: true });
    expect(allowed.blockers).toEqual([]);
    expect(allowed.notes.join(" ")).toMatch(/same disk is not a backup/);
  });

  it("blocks missing email, which locks every user out of their account", () => {
    const env = goodEnv({ EMAIL_WEBHOOK_URL: "" });
    expect(runDeployPreflight(env).blockers.join(" ")).toMatch(/permanently locked out/);
    expect(runDeployPreflight(env, { allowNoEmail: true }).blockers).toEqual([]);
  });

  it("blocks non-https email webhooks", () => {
    const result = runDeployPreflight(goodEnv({ EMAIL_WEBHOOK_URL: "http://mail.example.com/hook" }));
    expect(result.blockers.join(" ")).toMatch(/not https/);
  });

  it("blocks an unset retention policy, which fills the disk over time", () => {
    const env = goodEnv();
    delete env.BACKUP_RETENTION_DAYS;
    expect(runDeployPreflight(env).blockers.join(" ")).toMatch(/BACKUP_RETENTION_DAYS/);

    const zero = runDeployPreflight(goodEnv({ BACKUP_RETENTION_DAYS: "0" }));
    expect(zero.blockers.join(" ")).toMatch(/BACKUP_RETENTION_DAYS/);
  });

  it("always states the single-writer constraint", () => {
    const result = runDeployPreflight(goodEnv());
    expect(result.notes.join(" ")).toMatch(/single-writer|one application instance/);
    expect(result.notes.join(" ")).toMatch(/same disk is not a backup/);
  });

  it("warns, but does not block, when the backup directory is missing", () => {
    // A first deploy has no backup directory yet. Blocking here would make the
    // preflight unpassable exactly when you most need it.
    const result = runDeployPreflight(
      goodEnv({ RANKPILOT_BACKUP_DIR: join(root, "not-created-yet") })
    );
    expect(result.blockers.join(" ")).not.toMatch(/Backup directory/);
    expect(result.warnings.join(" ")).toMatch(/Backup directory is not ready/);
  });

  it("warns when NODE_ENV is not production, since boot checks are skipped", () => {
    const result = runDeployPreflight(goodEnv({ NODE_ENV: "staging" }));
    expect(result.warnings.join(" ")).toMatch(/NODE_ENV/);
  });
});

describe("resolveDataPaths", () => {
  it("agrees with the application on the database path", () => {
    // If the preflight resolves a different path than the app does, every check
    // it performs is theatre. Read the app's own source to confirm.
    expect(resolveDataPaths({ RANKPILOT_DB_PATH: dbPath }).db).toBe(resolve(dbPath));
    const source = readFileSync(join(process.cwd(), "src", "lib", "db", "db.ts"), "utf8");
    expect(source).toContain("RANKPILOT_DB_PATH");
  });

  it("resolves the database path through the same function the app opens", () => {
    // The rule used to be written out four times and kept in sync by a comment
    // asking people to sync it. This is the guard that comment could not be.
    for (const env of [
      {},
      { RANKPILOT_DB_PATH: dbPath },
      { DATABASE_PATH: dbPath },
      { RANKPILOT_DB_PATH: dbPath, DATABASE_PATH: join(root, "ignored.db") },
    ]) {
      expect(resolveDataPaths(env).db).toBe(databasePath(env));
    }
    // And the call sites must delegate rather than re-derive it.
    for (const file of ["scripts/backup.ts", "src/lib/deploy-preflight.ts", "scripts/init-db.ts"]) {
      const source = readFileSync(join(process.cwd(), ...file.split("/")), "utf8");
      expect(source, file).toContain("databasePath(");
      // The bug was a second copy of the precedence rule, not a reference to it.
      expect(source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ""), file).not.toMatch(
        /RANKPILOT_DB_PATH\s*\|\|\s*(env\.)?DATABASE_PATH/
      );
    }
  });

  it("agrees with the backup script on the backup path", () => {
    const source = readFileSync(join(process.cwd(), "scripts", "backup.ts"), "utf8");
    expect(source).toContain("process.env.RANKPILOT_BACKUP_DIR");
    expect(resolveDataPaths({ RANKPILOT_BACKUP_DIR: backupDir }).backups).toBe(resolve(backupDir));
  });

  it("resolves the backup path through the same function the status endpoint uses", () => {
    // These two used to be separate copies of the same rule, which is how the
    // original BACKUP_DIR / RANKPILOT_BACKUP_DIR drift bug happened. They must
    // now be one function, or a deploy could validate a directory the dashboard
    // never looks at.
    for (const env of [
      {},
      { RANKPILOT_BACKUP_DIR: backupDir },
      { BACKUP_DIR: backupDir },
      { RANKPILOT_BACKUP_DIR: backupDir, BACKUP_DIR: join(backupDir, "ignored") },
    ]) {
      expect(resolveDataPaths(env).backups).toBe(backupDirectory(env));
    }
  });
});

describe("initDirectories", () => {
  it("creates the directories on a fresh host, where a missing directory is the only blocker", () => {
    // The chicken-and-egg this fixes: the missing data directory is itself a
    // blocker, so gating creation on "no blockers" meant the flag was a no-op on
    // precisely the machines that needed it.
    rmSync(dbDir, { recursive: true, force: true });
    rmSync(backupDir, { recursive: true, force: true });
    const before = runDeployPreflight(goodEnv());
    expect(before.blockers.some(isMissingDirectoryBlocker)).toBe(true);
    expect(canDeploy(before)).toBe(false);

    const result = initDirectories(goodEnv());
    expect(result.created).toBe(true);
    expect(existsSync(dbDir)).toBe(true);
    expect(existsSync(backupDir)).toBe(true);
    // The re-run is what the CLI prints, so the deploy decision is the fresh one.
    expect(result.result.blockers).toEqual([]);
  });

  it("refuses to create anything while a real configuration blocker remains", () => {
    rmSync(dbDir, { recursive: true, force: true });
    // Missing passphrase is a blocker no directory creation can resolve. Creating
    // a directory anyway would report success for a host that is still unsafe.
    const result = initDirectories(goodEnv({ BACKUP_PASSPHRASE: "" }));
    expect(result.created).toBe(false);
    expect(result.reason).toMatch(/configuration blocker/);
    expect(result.reason).toMatch(/BACKUP_PASSPHRASE/);
    expect(existsSync(dbDir)).toBe(false);
  });

  it("does nothing when the environment already passes", () => {
    const result = initDirectories(goodEnv());
    expect(result.created).toBe(false);
    expect(result.reason).toMatch(/already deployable/);
  });

  it("only treats a missing directory as fixable, never another blocker", () => {
    expect(isMissingDirectoryBlocker('Database directory is unusable: "/x/data" does not exist.')).toBe(true);
    expect(isMissingDirectoryBlocker('Database directory is unusable: "/x/data" is not writable.')).toBe(false);
    expect(isMissingDirectoryBlocker("BACKUP_PASSPHRASE is not set")).toBe(false);
  });
});
