# Backup Runbook

A backup is not a backup until it has been restored. This runbook covers both.

## What is backed up

The entire SQLite database: `data/rankpilot.db` (path from `RANKPILOT_DB_PATH`).
That single file contains every customer's content, crawl results, users,
sessions, and billing records. There is no other persistent store — no object
storage, no external database.

## Taking a backup

```bash
npm run db:backup
```

Writes a timestamped snapshot to `backups/` (override with
`RANKPILOT_BACKUP_DIR`). Backups are **not** committed to git.

The script uses SQLite's `VACUUM INTO`, not a file copy. This matters: copying
`rankpilot.db` while writes are in flight can capture a torn page, producing a
file that looks fine and is corrupt. `VACUUM INTO` takes a consistent snapshot
and refuses to overwrite an existing file.

### Encryption

Set `BACKUP_PASSPHRASE` and snapshots are encrypted with **AES-256-GCM**, the key
derived from the passphrase with scrypt (`scripts/backup-crypto.ts`, no new
dependency). The plaintext snapshot is deleted once the ciphertext is written, so
you get `rankpilot-<stamp>.db.enc` and never a stray `.db`.

Treat the passphrase as a secret and keep it in a password manager, not only in
`.env`. **Losing it makes every encrypted backup unrecoverable** — that is the
trade for not storing customer emails and password hashes in plaintext.

Each snapshot gets a fresh random salt and IV, so two backups of identical data
do not produce identical ciphertext.

## Verifying a backup

```bash
npm run db:restore-test
```

This backs up, decrypts, restores to a scratch path, then asserts:

1. the recovered file matches the snapshot's **sha256** (not merely its size),
2. a wrong passphrase is rejected,
3. `PRAGMA integrity_check` returns `ok`,
4. every table can be read and row counts are reported,
5. old snapshots are pruned per `BACKUP_RETENTION_DAYS`, keeping at least the
   7 most recent.

Only after this prints `RESTORE VERIFIED` is the backup considered good.

## Restore procedure (real incident)

1. **Stop the app.** `Ctrl-C` the server. Never restore under a running process:
   the open connection will keep writing to the old file handle and can
   overwrite your restored data.
2. **Preserve the damaged file first.** Copy it somewhere else before touching
   it — it may be needed for forensics.
   ```powershell
   Copy-Item data/rankpilot.db "data/rankpilot.corrupt-$(Get-Date -Format yyyyMMdd-HHmmss).db"
   ```
3. **Decrypt the snapshot** (skip if you are restoring a plaintext `.db`).
   ```powershell
   $env:BACKUP_PASSPHRASE = "<from your password manager>"
   npx tsx -e "const{decrypt}=require('./scripts/backup-crypto');const{readFileSync,writeFileSync}=require('fs');writeFileSync('data/rankpilot.restored.db',decrypt(readFileSync('backups/<snapshot>.db.enc'),process.env.BACKUP_PASSPHRASE))"
   Remove-Item Env:BACKUP_PASSPHRASE
   ```
4. **Install the recovered database.**
   ```powershell
   Copy-Item "data/rankpilot.restored.db" "data/rankpilot.db"
   Remove-Item "data/rankpilot.db-wal","data/rankpilot.db-shm" -ErrorAction SilentlyContinue
   ```
   The `-wal` and `-shm` files belong to the *old* database. Leaving them
   alongside a restored file corrupts the result.
5. **Verify before starting.**
   ```bash
   npm run db:init   # applies any migrations the snapshot predates
   ```
   Then confirm `PRAGMA integrity_check` is `ok` and the row counts look right.
6. **Start the app** and check `/api/health/ready` returns 200.

## Retention

Set `BACKUP_RETENTION_DAYS` (e.g. `30`) and every run prunes snapshots older
than that. The **7 most recent are never deleted**, whatever their age, so a bad
value cannot empty the backup directory. Unset means snapshots accumulate
forever.

## Gaps — read this before relying on the above

- **No automated schedule.** Backups happen when someone runs the command.
  Nothing is scheduled, and nothing alerts on a missed backup.
- **No off-site copy.** `backups/` is on the same disk (and same OneDrive
  account) as the database. A disk-level failure or an account-level compromise
  takes both. Encryption does not help here: copy ciphertext to separate object
  storage and keep the passphrase somewhere the storage provider cannot reach.
- **Untested at scale.** The restore test proves correctness on a small
  database. It has not been exercised against a multi-gigabyte production file,
  where restore time becomes an RTO concern.
- **RPO / RTO are unmeasured.** No target is set. "Daily backup" implies an RPO
  of up to 24 hours of data loss, which has not been agreed with anyone.

## Verifying on a schedule

**Schedule `db:backup` for the backups and `db:restore-test` separately.**

An earlier version of this runbook told you to schedule `db:restore-test`,
because it took a backup and verified it in one command. That was wrong in two
ways, and both are now fixed:

- `db:restore-test` deletes the snapshot it created, so scheduling it would have
  left you with **no backups at all**. It is a verification command, and a
  verification run must not leave artifacts that look like backups — otherwise
  `GET /api/admin/status` reports backups as fresh forever, because CI runs this
  command on every commit, even after the real scheduled job has been dead for a
  month. Set `BACKUP_KEEP_VERIFY_SNAPSHOT=1` if you specifically want it to keep
  one, but do not put that in cron.
- Verifying a snapshot taken seconds earlier proves very little. It shows the
  backup path works, not that a backup from last Tuesday still restores. For that
  use `db:restore-test:retained`, which reads back the newest **retained** snapshot
  rather than taking a new one. It is the command that catches a scheduled job
  which has been failing for a week, and it refuses to pass when the newest
  snapshot is encrypted and the passphrase is unavailable — the failure you would
  otherwise meet mid-incident.

```bash
# Daily: take a real, retained backup.
0 3 * * * cd /srv/rankpilot && BACKUP_PASSPHRASE=... npm run db:backup

# Weekly: prove the code still writes recoverable backups. Non-zero exit if not.
30 4 * * 0 cd /srv/rankpilot && BACKUP_PASSPHRASE=... npm run db:restore-test

# Weekly: prove an actual retained snapshot still restores. Non-zero exit if not.
45 4 * * 0 cd /srv/rankpilot && BACKUP_PASSPHRASE=... npm run db:restore-test:retained
```

`db:restore-test:retained` prints the age of the snapshot it restored. A warning
about the staleness limit is the more important line: it means the daily job has
not run recently, which the restore itself cannot detect.

`db:restore-test` also prints how many snapshots are retained. If that number is
not growing, or `GET /api/admin/status` reports `backup.stale: true`, the daily
job is not running.

