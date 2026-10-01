# Disaster Recovery Runbook

Scope: a single-node Next.js application whose only persistent state is one
SQLite file. There is no multi-region setup, no replica, and no external
database. Recovery means restoring that file.

## Recovery objectives (proposed, not yet agreed)

| Objective | Value | Status |
|---|---|---|
| RPO (max data loss) | 24h with daily backups | Proposed; no schedule is automated yet |
| RTO (max downtime) | ~15 min for a single-node restore | Estimated, not measured at production volume |

Neither figure has been validated against a production-sized database. Treat
them as targets to measure, not commitments.

## Read this first: encryption and the passphrase

If `BACKUP_PASSPHRASE` is set, snapshots are AES-256-GCM encrypted
(`RPKB1 | salt | iv | authTag | ciphertext`, key derived with scrypt) and carry a
`.db.enc` extension. There is no plaintext copy, and **the passphrase is the only
thing that makes the backup readable.** Losing it means losing every snapshot,
permanently, with no recovery path.

Before you need this, confirm all three of these:

1. `BACKUP_PASSPHRASE` is set in the environment that actually runs
   `npm run db:backup`. If it is unset, backups are written as plaintext `.db`
   and the script prints a warning — encryption is conditional, not automatic.
2. The passphrase is stored somewhere **other than the app host**. The app host
   is the thing most likely to be lost (see scenario 4). A passphrase in that
   host's `.env` protects against an attacker reading a backup file, and against
   nothing else.
3. You have actually run a restore. `npm run db:restore-test` proves the current
   passphrase decrypts the current snapshots. An untested backup is a guess.

If the passphrase is lost, the only honest options are restoring from somewhere
else (an older plaintext copy, a pre-encryption snapshot, a replica) or
reconstructing from upstream data. Encryption cannot be bypassed.

## Failure scenarios

### 0. Passphrase lost or forgotten

**Symptoms:** `db:restore-test` fails authentication on every snapshot. The
snapshots are not corrupt; they are unreadable by design.

**Recovery:** none, for the affected snapshots. This is why the passphrase needs
an off-host home. Going forward, store it in a password manager or secret store,
and re-run `db:backup` so new snapshots are recoverable.

### 1. Database file corrupt or unreadable

**Symptoms:** `/api/health/ready` returns 503. The app logs a database error.
**Recovery:** follow `BACKUP_RUNBOOK.md` §Restore procedure. The short version:
decrypt the newest `.db.enc` to a `.db`, verify it with `PRAGMA integrity_check`,
swap it in, and restart. `npm run db:restore-test` does the decrypt and verify
for you and will tell you the table counts, which is worth reading before you
trust the data.

### 1a. Corruption suspected in a backup rather than the live database

**Recovery:** `db:restore-test` verifies the recovered snapshot's SHA-256 against
the snapshot, runs `integrity_check`, and rejects a wrong passphrase or tampered
ciphertext. It never modifies the snapshot. Run it against the backups
periodically; a snapshot that cannot be decrypted is not a backup.

### 2. Accidental deletion of data (e.g. a bad migration, wrong DELETE)

**Symptoms:** the app runs fine; specific records are missing. Health stays 200.
**Recovery:** stop the app, restore the most recent snapshot, and accept the
loss of everything written since that snapshot. There is no point-in-time
recovery — `VACUUM INTO` snapshots are not a time series.

This is the scenario that most justifies off-site, longer-retention backups.
A single daily snapshot cannot recover a mistake made two hours ago.

### 3. Disk full

**Symptoms:** `SQLITE_FULL`, writes failing, jobs erroring.
**Recovery:** free space, then `npm run db:restore-test` to confirm the
database is still intact. A truncated database from a full disk is a real
failure mode, so verify rather than assume. Note that `db:restore-test`
decrypts, so `BACKUP_PASSPHRASE` must be set in that shell too — an unset
passphrase is a configuration error here, not a licence to skip verification.

### 4. Host lost entirely

**Recovery:** provision a new host, deploy, restore the latest snapshot. All
in-flight background jobs are lost; the job lease reaper re-queues anything
that was left `running` once the worker restarts, so crawling resumes.

Two things make this materially worse than it looks:

- **The passphrase must come with you**, from somewhere off the lost host. If it
  only existed in the old host's environment, every snapshot is unreadable. See
  "Read this first" above.
- Snapshots are on the lost host unless they were copied off-site, and no
  off-site copy is configured. **Today this scenario is only survivable if you
  take a copy of `backups/` by hand.**

### 4a. Accidental `POST /api/admin/erasure`

**Symptoms:** a tenant's data is gone; health stays 200 because nothing is
broken, only absent.
**Recovery:** restore the pre-erasure snapshot and accept the loss of
everything written since. This is the sharpest illustration of why
`POST /api/admin/erasure` is dry-run by default and requires the tenant id to
be repeated. Audit rows for the erasure are retained and anonymized rather than
deleted, so the record survives — but the data it refers to does not.

### 5. Secret compromise (`AUTH_SECRET` leaked)

**Recovery:** rotate `AUTH_SECRET` and restart. Because the secret signs the
session cookie, **every existing session becomes invalid at once** and all
users must sign in again. This is the intended behaviour. Then revoke sessions
deliberately if you want a clean break:
`UPDATE sessions SET revoked_at = <now> WHERE revoked_at IS NULL;`

## What is NOT covered

- **Point-in-time recovery.** No WAL archiving, no binary log shipping.
- **Off-site or scheduled backups.** None. `npm run db:backup` is manual, and
  snapshots land in `backups/` on the same host as the database they protect.
  This is the largest single gap in this runbook: a host-level failure takes the
  backups with it. See "Read this first".
- **Cross-region failover.** Single node, single region.
- **Horizontal scale-out.** SQLite does not support multiple app nodes writing
  to one file safely. Scaling out requires migrating to PostgreSQL or giving
  each node its own database — see the readiness report for the measured
  concurrency numbers that inform that decision.
- **Backup of external state.** There is none: no object storage, no email
  provider state, no third-party config.
- **Restore rehearsal.** No automated, scheduled verification that backups are
  still decryptable. `GET /api/admin/status` reports backup staleness, but
  nothing pages a human when a backup silently stops being taken.

## Post-incident checklist

1. Confirm `/api/health/live` and `/api/health/ready` both return 200.
2. Check `GET /api/admin/status` (owner-only) for a non-zero failed-job count —
   a restore will often leave queued work that needs draining.
3. Run `npm run db:restore-test` to confirm the *new* live database snapshots
   cleanly, so the next backup is not built on a bad restore.
4. Record what was lost, how long it took, and whether the runbook was wrong.
   Update this document with what you learned.
