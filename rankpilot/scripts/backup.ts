import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { databasePath } from "../src/lib/db/db";
// Same threshold GET /api/admin/status and post-deploy check read, so this
// command cannot call a backup fresh while the dashboard calls it stale.
import { staleAfterHours } from "../src/lib/backup-status";
import { decrypt, encrypt, isEncryptionConfigured } from "./backup-crypto";

function sha256(payload: Buffer): string {
  return createHash("sha256").update(payload).digest("hex");
}

/**
 * Backup and verified restore.
 *
 * A backup is not a backup until a restore has been read back and verified.
 * `--verify` takes a real backup of a seeded database, restores it to a
 * scratch path, and asserts the restored copy is byte-identical and actually
 * openable, with the row counts intact.
 *
 * Uses SQLite's own `VACUUM INTO`, which produces a consistent single-file
 * snapshot even while writes are in flight. Copying the .db file directly is
 * the classic mistake: it can capture a torn page mid-transaction.
 */

const args = new Set(process.argv.slice(2));
const verifyOnly = args.has("--verify");

function dbPaths(): { live: string } {
  // Delegated to the app's own resolver. This used to be a hand-kept copy of the
  // rule in src/lib/db/db.ts, which is how the script once backed up a different
  // file than the application was writing.
  return { live: databasePath() };
}

function stamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function backupDir(): string {
  return resolve(process.env.RANKPILOT_BACKUP_DIR || join(process.cwd(), "backups"));
}

function main(): void {
  const { live } = dbPaths();

  if (!existsSync(live)) {
    console.error(`No database at ${live}. Run \`npm run db:init\` first.`);
    process.exit(1);
  }

  mkdirSync(backupDir(), { recursive: true });
  const target = join(backupDir(), `rankpilot-${stamp()}.db`);

  // VACUUM INTO refuses to overwrite, which is exactly the safety we want.
  // The destination must be a SQL string literal in single quotes; a
  // double-quoted path is parsed as an identifier and fails.
  execFileSync(process.execPath, [
    "-e",
    `const {DatabaseSync}=require('node:sqlite');
     const d=new DatabaseSync(process.argv[1]);
     const lit=String.fromCharCode(39)+process.argv[2].split(String.fromCharCode(39)).join(String.fromCharCode(39)*2)+String.fromCharCode(39);
     d.exec('VACUUM INTO '+lit);
     d.close();`,
    live,
    target,
  ]);

  const size = statSync(target).size;
  const plaintextHash = sha256(readFileSync(target));
  console.log(`Backup written: ${target} (${(size / 1024).toFixed(1)} KiB)`);

  // Encrypt on every backup, not only when verifying. `db:backup` is the command
  // an operator runs on a schedule, so encrypting only in the verify path would
  // leave the routine backup sitting on disk in plaintext -- and the snapshot
  // contains customer emails, password hashes, and session hashes.
  const encryptedPath = `${target}.enc`;
  const encrypted = isEncryptionConfigured();
  if (encrypted) {
    const payload = encrypt(readFileSync(target), process.env.BACKUP_PASSPHRASE as string);
    writeFileSync(encryptedPath, payload);
    rmSync(target, { force: true });
    console.log(`Encrypted with AES-256-GCM: ${encryptedPath} (${(payload.length / 1024).toFixed(1)} KiB)`);
  } else {
    console.log("WARNING: BACKUP_PASSPHRASE is not set, so this snapshot is unencrypted.");
  }

  if (!verifyOnly) {
    console.log(`\n${listBackups().length} snapshot(s) in ${backupDir()}.`);
    pruneOldBackups();
    return;
  }

  console.log("\n--- restore verification ---");

  // A verification run must not leave a snapshot behind. `db:restore-test` runs
  // in CI on every commit, and every run was adding a full encrypted copy of the
  // database to the backup directory that nothing ever removed -- retention is
  // opt-in, so nothing did. That fills the disk, which is the exact failure the
  // DR runbook lists, and it is worse than that: those stray snapshots are
  // recent, so `GET /api/admin/status` would report backups as fresh even if the
  // real scheduled backup job had been dead for a month. A verification command
  // must not manufacture the evidence that backups are working.
  //
  // Set BACKUP_KEEP_VERIFY_SNAPSHOT=1 to keep it, e.g. when you deliberately ran
  // this because you wanted a backup as well.
  const keepVerifySnapshot = process.env.BACKUP_KEEP_VERIFY_SNAPSHOT === "1";
  const createdSnapshot = encrypted ? encryptedPath : target;
  const cleanup = () => {
    if (keepVerifySnapshot) return;
    try {
      rmSync(createdSnapshot, { force: true });
    } catch {
      // Best effort; a leftover file is an annoyance, not a failed backup.
    }
  };
  // 'exit' rather than a plain call, because this script reports failure with
  // process.exit(1) from several places and those paths must clean up too.
  process.on("exit", cleanup);

  // The restore path is what proves the snapshot is recoverable, so it must
  // decrypt exactly the way a real disaster would, not shortcut around it.
  const restoreTo = join(backupDir(), `restore-check-${stamp()}.db`);

  if (encrypted) {
    const passphrase = process.env.BACKUP_PASSPHRASE as string;
    writeFileSync(restoreTo, decrypt(readFileSync(encryptedPath), passphrase));

    // A wrong passphrase must fail loudly here rather than during an incident.
    try {
      decrypt(readFileSync(encryptedPath), "definitely-the-wrong-passphrase");
      console.error("FAIL: decryption succeeded with the wrong passphrase");
      process.exit(1);
    } catch {
      console.log("Wrong passphrase correctly rejected");
    }
  } else {
    copyFileSync(target, restoreTo);
  }

  // Content equality, not size equality. Comparing the encrypted file to the
  // restored plaintext would differ by the header and GCM overhead and prove
  // nothing; the claim that matters is that the recovered database is
  // bit-for-bit the database that was backed up.
  const restoredSize = statSync(restoreTo).size;
  if (restoredSize !== size) {
    console.error(`FAIL: restored ${restoredSize} bytes but the snapshot was ${size}`);
    process.exit(1);
  }
  const restoredHash = sha256(readFileSync(restoreTo));
  if (restoredHash !== plaintextHash) {
    console.error(`FAIL: restored content differs from the snapshot (sha256 ${restoredHash} != ${plaintextHash})`);
    process.exit(1);
  }
  console.log(`Restored content matches the snapshot exactly (${restoredSize} bytes, sha256 ${restoredHash.slice(0, 12)}...)`);

  // The real test: can the restored file be opened and does it still hold the
  // data? A valid-looking file that will not open is worthless.
  const report = execFileSync(
    process.execPath,
    [
      "-e",
      `const {DatabaseSync}=require('node:sqlite');
       const d=new DatabaseSync(process.argv[1]);
       const tables=d.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map(r=>r.name);
       const integrity=d.prepare("PRAGMA integrity_check").get();
       const counts={};
       for (const t of tables) { if (t.startsWith('sqlite_')) continue;
         try { counts[t]=d.prepare('SELECT COUNT(*) AS n FROM "'+t+'"').get().n; } catch {} }
       process.stdout.write(JSON.stringify({tables:tables.length,integrity,counts}));`,
      restoreTo,
    ],
    { encoding: "utf8" }
  );

  const parsed = JSON.parse(report) as { tables: number; integrity: { integrity_check: string }; counts: Record<string, number> };
  if (parsed.integrity.integrity_check !== "ok") {
    console.error(`FAIL: integrity_check returned ${parsed.integrity.integrity_check}`);
    process.exit(1);
  }
  console.log(`integrity_check: ok`);
  console.log(`Tables restored: ${parsed.tables}`);
  const nonEmpty = Object.entries(parsed.counts).filter(([, n]) => n > 0);
  console.log(`Non-empty tables: ${nonEmpty.length ? nonEmpty.map(([t, n]) => `${t}=${n}`).join(", ") : "none (empty database)"}`);
  console.log(`\nRESTORE VERIFIED: ${restoreTo} opens cleanly and passes integrity_check.`);

  rmSync(restoreTo, { force: true });
  cleanup();
  const kept = listBackups();
  console.log(`\n${kept.length} backup file(s) retained in ${backupDir()}.`);
  if (keepVerifySnapshot) {
    console.log(`Verification snapshot kept: ${createdSnapshot}`);
  } else {
    console.log(
      `Verification snapshot removed: ${createdSnapshot} (set BACKUP_KEEP_VERIFY_SNAPSHOT=1 to keep it; use \`npm run db:backup\` to take a real backup)`
    );
  }
  pruneOldBackups();
}

interface BackupFile {
  name: string;
  path: string;
  ageMs: number;
  encrypted: boolean;
}

/** Sorted youngest first, so index 0 is the most recent snapshot. */
function listBackups(): BackupFile[] {
  return readdirSync(backupDir())
    .filter((f) => f.startsWith("rankpilot-") && (f.endsWith(".db") || f.endsWith(".db.enc")))
    .map((name) => {
      const path = join(backupDir(), name);
      return { name, path, ageMs: Date.now() - statSync(path).mtimeMs, encrypted: name.endsWith(".enc") };
    })
    .sort((a, b) => a.ageMs - b.ageMs);
}

/**
 * Retention. Every run kept saying "apply a retention policy before relying on
 * this" and then not applying one, so an unattended daily job would fill the
 * disk and take the database down with it.
 *
 * Safety floor: the most recent MIN_KEPT snapshots are never deleted, whatever
 * their age. A pruning bug that empties the backup directory is far worse than
 * a full disk, so the cutoff is advisory and the floor is absolute.
 */
const MIN_KEPT = 7;

function pruneOldBackups(): void {
  const keepDays = Number(process.env.BACKUP_RETENTION_DAYS);
  const backups = listBackups(); // youngest first
  if (!Number.isFinite(keepDays) || keepDays <= 0) {
    console.log("BACKUP_RETENTION_DAYS is not set, so backups are kept indefinitely.");
    return;
  }

  const keepFloor = Math.min(backups.length, MIN_KEPT);
  // Compare age to age. Comparing an age in ms against an absolute timestamp
  // makes the comparison always true, which silently disables retention.
  const maxAgeMs = keepDays * 86_400_000;

  let pruned = 0;
  // Everything past the floor, oldest last.
  for (const backup of backups.slice(keepFloor)) {
    if (backup.ageMs < maxAgeMs) continue;
    rmSync(backup.path, { force: true });
    pruned++;
    console.log(`Pruned ${backup.name} (${Math.floor(backup.ageMs / 86_400_000)}d old)`);
  }
  console.log(
    `Retention: pruned ${pruned} snapshot(s) older than ${keepDays}d ` +
      `from ${backups.length} (keeping the ${keepFloor} most recent).`
  );
}

/**
 * Restores an existing snapshot from the backup directory and checks it opens.
 *
 * `db:restore-test` verifies a snapshot it just took itself, which proves the
 * backup code works but says nothing about the snapshots an operator would
 * actually restore from. Those are the ones that matter: they are days old, they
 * were written by an earlier version of the schema, and they are the only ones
 * that exist if the backup job has been failing silently for a week. This is the
 * read-back a disaster recovery plan actually depends on.
 *
 * The age of the snapshot is reported, because restoring a 40-day-old snapshot
 * and printing "VERIFIED" without saying so is a misleading all-clear.
 */
function verifyRetainedSnapshot(): void {
  const snapshots = listBackups();
  if (snapshots.length === 0) {
    console.error(
      `FAIL: no snapshots in ${backupDir()}, so there is nothing to restore. ` +
        "If the scheduled backup job has never run, this is what it looks like."
    );
    process.exit(1);
  }

  const newest = snapshots[0];
  const ageHours = newest.ageMs / 3_600_000;
  console.log(`Verifying the newest retained snapshot: ${newest.name}`);
  console.log(`  age: ${ageHours.toFixed(1)}h old, ${snapshots.length} snapshot(s) in ${backupDir()}`);

  const limit = staleAfterHours();
  if (ageHours > limit) {
    // Not fatal: a stale snapshot can still be restorable, and refusing to check
    // it would bury the more urgent problem, which is that the backup job has
    // died. post-deploy check and GET /api/admin/status treat the same condition
    // as fatal.
    console.warn(
      `  WARNING: older than the ${limit}h limit, so the scheduled backup job has not run recently. ` +
        "A restore would lose everything since it was taken."
    );
  }

  const restoreTo = join(backupDir(), `restore-check-${stamp()}.db`);
  try {
    if (newest.encrypted) {
      const passphrase = process.env.BACKUP_PASSPHRASE;
      if (!passphrase) {
        console.error(
          "FAIL: the newest snapshot is encrypted but BACKUP_PASSPHRASE is not set, so it cannot be read back. " +
            "This surfaces during an incident, which is exactly the wrong time to find out."
        );
        process.exit(1);
      }
      writeFileSync(restoreTo, decrypt(readFileSync(newest.path), passphrase));
    } else {
      copyFileSync(newest.path, restoreTo);
    }
  } catch (error) {
    console.error(`FAIL: could not read ${newest.name}: ${(error as Error).message}`);
    process.exit(1);
  }

  // Asks SQLite to open the file, rather than trusting a byte count. A snapshot
  // can decrypt perfectly and still be unusable, and only opening it shows that.
  try {
    const report = JSON.parse(
      execFileSync(
        process.execPath,
        [
          "-e",
          `const {DatabaseSync}=require('node:sqlite');
           const d=new DatabaseSync(process.argv[1]);
           const tables=d.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map(r=>r.name);
           const integrity=d.prepare("PRAGMA integrity_check").get();
           const counts={};
           for (const t of tables) { if (t.startsWith('sqlite_')) continue;
             try { counts[t]=d.prepare('SELECT COUNT(*) AS n FROM "'+t+'"').get().n; } catch {} }
           process.stdout.write(JSON.stringify({tables:tables.length,integrity,counts}));`,
          restoreTo,
        ],
        { encoding: "utf8" }
      )
    ) as { tables: number; integrity: { integrity_check: string }; counts: Record<string, number> };

    if (report.integrity.integrity_check !== "ok") {
      console.error(`FAIL: integrity_check on ${newest.name} returned ${report.integrity.integrity_check}`);
      process.exit(1);
    }
    const nonEmpty = Object.entries(report.counts).filter(([, n]) => n > 0);
    console.log("integrity_check: ok");
    console.log(`Tables: ${report.tables}`);
    console.log(
      `Non-empty tables: ${nonEmpty.length ? nonEmpty.map(([t, n]) => `${t}=${n}`).join(", ") : "none (empty database)"}`
    );
    console.log(
      `\nRETAINED SNAPSHOT VERIFIED: ${newest.name} (${ageHours.toFixed(1)}h old) restores and opens cleanly.`
    );
  } catch (error) {
    console.error(`FAIL: ${newest.name} restored to a file that would not open: ${(error as Error).message}`);
    process.exit(1);
  } finally {
    rmSync(restoreTo, { force: true });
  }
}

if (args.has("--verify-retained")) verifyRetainedSnapshot();
else main();
