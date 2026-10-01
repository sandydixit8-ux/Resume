import { mkdtempSync, readFileSync, rmSync, writeFileSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { backupDirectory, backupStatus, describeBackupStatus, staleAfterHours } from "./backup-status";

/**
 * Backup freshness reporting.
 *
 * The failure this exists to catch is silent: a backup job dies, nothing
 * errors, the app keeps serving, and the loss is discovered on the day someone
 * needs a restore. These tests are mostly about not being fooled into reporting
 * health that does not exist.
 */

let dir: string;
const savedDir = process.env.RANKPILOT_BACKUP_DIR;
const savedStale = process.env.BACKUP_STALE_HOURS;

function snapshot(name: string, ageHours: number): string {
  const path = join(dir, name);
  writeFileSync(path, "not a real database");
  const when = new Date(Date.now() - ageHours * 3_600_000);
  utimesSync(path, when, when);
  return path;
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "backup-status-"));
  process.env.RANKPILOT_BACKUP_DIR = dir;
  delete process.env.BACKUP_STALE_HOURS;
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  if (savedDir === undefined) delete process.env.RANKPILOT_BACKUP_DIR;
  else process.env.RANKPILOT_BACKUP_DIR = savedDir;
  if (savedStale === undefined) delete process.env.BACKUP_STALE_HOURS;
  else process.env.BACKUP_STALE_HOURS = savedStale;
  void savedStale;
});

describe("backupDirectory", () => {
  it("reads the same environment variable the backup script writes to", () => {
    // Guards against a drift bug: an earlier version of this module read
    // BACKUP_DIR while scripts/backup.ts read RANKPILOT_BACKUP_DIR, so the
    // status endpoint reported "no snapshots" while backups existed on disk.
    // The assertion is on the script's source so the two cannot diverge.
    const source = readFileSync(
      join(process.cwd(), "scripts", "backup.ts"),
      "utf8"
    );
    expect(source).toContain("process.env.RANKPILOT_BACKUP_DIR");
    expect(backupDirectory()).toBe(resolve(dir));
  });
});

describe("backupStatus", () => {
  it("reports never-taken, not merely stale, when the directory is empty", () => {
    const status = backupStatus();
    expect(status.never).toBe(true);
    expect(status.stale).toBe(true);
    expect(status.count).toBe(0);
    expect(status.newestFile).toBeNull();
    expect(status.ageHours).toBeNull();
  });

  it("reports never-taken when the directory does not exist", () => {
    rmSync(dir, { recursive: true, force: true });
    const status = backupStatus();
    expect(status.exists).toBe(false);
    expect(status.never).toBe(true);
    expect(status.stale).toBe(true);
  });

  it("finds the newest snapshot and reports its age", () => {
    snapshot("rankpilot-old.db.enc", 50);
    snapshot("rankpilot-new.db.enc", 2);
    snapshot("rankpilot-middle.db.enc", 20);

    const status = backupStatus();
    expect(status.never).toBe(false);
    expect(status.count).toBe(3);
    expect(status.newestFile).toContain("rankpilot-new.db.enc");
    expect(status.ageHours).toBeCloseTo(2, 0);
    expect(status.stale).toBe(false);
  });

  it("treats encrypted and plaintext snapshots alike, and reports which the newest is", () => {
    snapshot("rankpilot-new.db", 1);
    snapshot("rankpilot-old.db.enc", 30);
    const status = backupStatus();
    expect(status.count).toBe(2);
    expect(status.encrypted).toBe(false);
    expect(status.stale).toBe(false);
  });

  it("goes stale past the threshold", () => {
    snapshot("rankpilot.db.enc", 30);
    const status = backupStatus();
    expect(status.stale).toBe(true);
    expect(status.staleAfterHours).toBe(26);
  });

  it("respects a configured threshold", () => {
    process.env.BACKUP_STALE_HOURS = "48";
    expect(staleAfterHours()).toBe(48);

    // 30h old: fine at a 48h threshold.
    snapshot("rankpilot.db.enc", 30);
    expect(backupStatus().stale).toBe(false);

    // 60h old: past it. This must be the newest file, so remove the other.
    rmSync(join(dir, "rankpilot.db.enc"));
    snapshot("rankpilot-older.db.enc", 60);
    expect(backupStatus().stale).toBe(true);
  });

  it("ignores a nonsense threshold rather than marking everything stale or healthy", () => {
    for (const bad of ["0", "-5", "abc", ""]) {
      process.env.BACKUP_STALE_HOURS = bad;
      expect(staleAfterHours()).toBe(26);
    }
  });

  it("does not count a restore-check artifact as a backup", () => {
    // This is the subtle one. `db:restore-test` writes restore-check-*.db into
    // the backup directory. Counting it would let a completely broken backup job
    // look healthy because someone verified old snapshots by hand.
    snapshot("rankpilot-real.db.enc", 40);
    snapshot("restore-check-2026-01-01T00-00-00-000Z.db", 0.01);

    const status = backupStatus();
    expect(status.count).toBe(1);
    expect(status.newestFile).toContain("rankpilot-real.db.enc");
    expect(status.stale).toBe(true);
  });

  it("ignores WAL sidecars and dotfiles", () => {
    snapshot("rankpilot-real.db", 40);
    writeFileSync(join(dir, "rankpilot-real.db-wal"), "x");
    writeFileSync(join(dir, "rankpilot-real.db-shm"), "x");
    writeFileSync(join(dir, ".hidden.db"), "x");

    const status = backupStatus();
    expect(status.count).toBe(1);
  });

  it("does not report a negative age if a file has a future mtime", () => {
    const path = join(dir, "rankpilot-future.db.enc");
    writeFileSync(path, "x");
    const future = new Date(Date.now() + 5 * 3_600_000);
    utimesSync(path, future, future);
    const status = backupStatus();
    // Clock skew should not produce a negative age or a bogus "0h old".
    expect(status.ageHours).toBe(0);
  });

  it("uses a fixed reference time so age is deterministic", () => {
    const path = join(dir, "rankpilot.db.enc");
    writeFileSync(path, "x");
    const when = new Date("2026-01-01T00:00:00.000Z");
    utimesSync(path, when, when);
    const status = backupStatus(new Date("2026-01-02T00:00:00.000Z"));
    expect(status.ageHours).toBe(24);
    expect(status.stale).toBe(false);
  });
});

describe("describeBackupStatus", () => {
  it("says plainly that there is nothing to restore from", () => {
    expect(describeBackupStatus(backupStatus())).toMatch(/nothing to recover from/);
  });

  it("names the age and the threshold when stale", () => {
    snapshot("rankpilot.db.enc", 40);
    const text = describeBackupStatus(backupStatus());
    expect(text).toMatch(/past the 26h threshold/);
  });

  it("does not complain when the newest snapshot is fresh", () => {
    snapshot("rankpilot.db.enc", 1);
    expect(describeBackupStatus(backupStatus())).not.toMatch(/threshold/);
  });
});
