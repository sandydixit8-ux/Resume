import { readdirSync, statSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * Backup freshness, so a backup that silently stops happening is visible.
 *
 * Backups fail quietly. A cron that dies, a full disk, a changed path, a
 * passphrase that expired — none of them raise an error anywhere, and the
 * database keeps serving happily. The only symptom is that the day you need a
 * restore there is nothing recent to restore, which is the worst possible time
 * to discover it.
 *
 * This is deliberately a filesystem check rather than a record in the database.
 * A database row saying "I took a backup" is written by the same process that
 * might be failing, and the snapshot files themselves are the ground truth: if
 * the files are not there, there is no backup, whatever anything claims.
 */

const SNAPSHOT_EXTENSIONS = [".db.enc", ".db"];

export interface BackupStatus {
  /** Absolute path inspected, whether or not it exists. */
  directory: string;
  exists: boolean;
  /** Newest snapshot, or null when there are none. */
  newestFile: string | null;
  newestAt: string | null;
  /** Whole hours since the newest snapshot; null when there are none. */
  ageHours: number | null;
  count: number;
  /** True when the newest snapshot is encrypted. Mixed directories report on the newest. */
  encrypted: boolean | null;
  /** Past `staleAfterHours`. */
  stale: boolean;
  staleAfterHours: number;
  /** Never taken at all. Distinguished from stale, because the response differs. */
  never: boolean;
}

export function backupDirectory(
  env: Record<string, string | undefined> = process.env
): string {
    // Must match backup.ts, or the status endpoint inspects a different directory
    // than the one the backup job writes to and reports "no snapshots" while the
    // backups are sitting right there. `BACKUP_DIR` is accepted as a fallback for
    // the shorter spelling. Both default to a cwd-relative `backups`, which is
    // why production should set this to an absolute path rather than rely on the
    // working directory of whatever process happens to run the backup job.
    //
    // The env is injected so this can be the single source of truth: the deploy
    // preflight resolves its backup path through here too, which is what stops
    // the two copies of this rule from drifting apart again.
    const configured = env.RANKPILOT_BACKUP_DIR || env.BACKUP_DIR;
    return resolve(configured || join(process.cwd(), "backups"));
  }

/**
 * Default staleness threshold is one day plus a margin, so a daily job that ran
 * slightly late does not raise a false alarm, but a job that has missed a whole
 * run does.
 */
export function staleAfterHours(): number {
  const configured = Number(process.env.BACKUP_STALE_HOURS);
  return Number.isFinite(configured) && configured > 0 ? configured : 26;
}

/**
 * Ignores anything that is not a snapshot. In particular a `restore-check-*.db`
 * left behind by `db:restore-test` is a temporary artifact of a verification
 * run, not evidence that a scheduled backup is working — counting it would let
 * a broken backup job look healthy purely because someone verified it by hand.
 */
function isSnapshot(name: string): boolean {
  if (name.startsWith("restore-check-")) return false;
  if (name.startsWith(".")) return false; // WAL/SHM sidecars and dotfiles
  return SNAPSHOT_EXTENSIONS.some((ext) => name.endsWith(ext));
}

export function backupStatus(now: Date = new Date()): BackupStatus {
  const directory = backupDirectory();
  const threshold = staleAfterHours();
  const base: BackupStatus = {
    directory,
    exists: existsSync(directory),
    newestFile: null,
    newestAt: null,
    ageHours: null,
    count: 0,
    encrypted: null,
    stale: true,
    staleAfterHours: threshold,
    never: true,
  };
  if (!base.exists) return base;

  let files: string[];
  try {
    files = readdirSync(directory);
  } catch {
    // Unreadable directory is not the same as "no backups", but for the caller's
    // purposes both mean there is nothing to restore, so it reports stale.
    return base;
  }

  let newest: { name: string; mtimeMs: number } | null = null;
  let count = 0;
  for (const name of files) {
    if (!isSnapshot(name)) continue;
    count++;
    try {
      const { mtimeMs } = statSync(join(directory, name));
      if (!newest || mtimeMs > newest.mtimeMs) newest = { name, mtimeMs };
    } catch {
      // Vanished or unreadable between readdir and stat; skip it.
    }
  }
  if (!newest) return base;

  const ageHours = Math.max(0, (now.getTime() - newest.mtimeMs) / 3_600_000);
  return {
    directory,
    exists: true,
    newestFile: join(directory, newest.name),
    newestAt: new Date(newest.mtimeMs).toISOString(),
    ageHours: Math.round(ageHours * 10) / 10,
    count,
    // false for a plaintext snapshot, which is a real and reportable state:
    // it means the newest backup is unprotected, not that the answer is unknown.
    // null is reserved for "there are no snapshots".
    encrypted: newest.name.endsWith(".db.enc"),
    stale: ageHours > threshold,
    staleAfterHours: threshold,
    never: false,
  };
}

/** One-line summary for boot logs and the status endpoint. */
export function describeBackupStatus(status: BackupStatus): string {
  if (status.never) {
    return `no snapshots found in ${status.directory}; a restore would have nothing to recover from`;
  }
  const age = status.ageHours === null ? "unknown age" : `${status.ageHours}h old`;
  return status.stale
    ? `newest snapshot is ${age}, past the ${status.staleAfterHours}h threshold`
    : `newest snapshot is ${age}`;
}
