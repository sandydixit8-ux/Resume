# DEPLOYMENT.md

Operational runbook for running RankPilot on a single Linux host. Everything here
matches what is actually in the repository; if a step names a file or a command,
that file exists and that command is a real `package.json` script.

RankPilot is a single-writer application. The database is a SQLite file, so it
scales vertically only. Two processes on one volume will contend for the write
lock, and two processes on separate volumes will diverge silently. The service
unit is deliberately a single unit with no horizontal scaling, and
`src/lib/deploy-preflight.ts` refuses paths that would put the database on
storage the platform wipes between deploys.

- [1. What the host needs](#1-what-the-host-needs)
- [2. First deploy](#2-first-deploy)
- [3. Routine deploys](#3-routine-deploys)
- [4. Configuration](#4-configuration)
- [5. Backups](#5-backups)
- [6. Verifying a deploy](#6-verifying-a-deploy)
- [7. Recovering](#7-recovering)
- [8. Troubleshooting](#8-troubleshooting)

## 1. What the host needs

- Linux with systemd. The unit uses `ProtectSystem=strict`, `StateDirectory` and
  `ReadWritePaths`, none of which mean anything elsewhere.
- Node.js 20 or newer.
- A persistent, non-ephemeral volume for the data directory. The preflight blocks
  paths under `/tmp`, `/var/task`, `/dev/shm`, `/run` and CI work directories, and
  it also refuses a *relative* `RANKPILOT_DB_PATH`, because a relative path
  resolves differently at build time than at run time.
- A hostname and TLS certificate. In production the site URL must be `https://`,
  or canonical tags, `sitemap.xml` and `robots.txt` will point somewhere search
  engines do not trust.

Create the service account and the data directory:

```sh
sudo useradd --system --home /srv/rankpilot --shell /usr/sbin/nologin rankpilot
sudo install -d -o rankpilot -g rankpilot -m 0750 /var/lib/rankpilot
sudo install -d -o root -g rankpilot -m 0750 /etc/rankpilot
```

## 2. First deploy

Put the release at `/srv/rankpilot/app`, owned by `rankpilot`. Then write the
environment file, which holds the secrets:

```sh
sudo install -o root -g rankpilot -m 0640 /dev/null /etc/rankpilot/rankpilot.env
sudoedit /etc/rankpilot/rankpilot.env
```

The file must be `0640` and owned by `root:rankpilot`. The service reads it as
`EnvironmentFile`, so the process never has to read it directly, and a
world-readable copy of `AUTH_SECRET` would let anyone mint sessions.

Build and install the unit:

```sh
cd /srv/rankpilot/app
sudo -u rankpilot npm ci
sudo -u rankpilot SITE_URL=https://your-domain npm run build
sudo install -o root -g root -m 0644 deploy/rankpilot.service /etc/systemd/system/rankpilot.service
sudo systemctl daemon-reload
sudo systemctl enable --now rankpilot
```

`SITE_URL` must be set **at build time**, not only at run time. Canonical URLs and
the sitemap are baked into the build output; setting the variable afterwards leaves
the running site advertising a different origin than the one it serves.

The unit runs migrations itself. `ExecStartPre` applies `npm run db:init`, which
prints the absolute path of the database it opened:

```sh
journalctl -u rankpilot -n 40 --no-pager
```

```
RankPilot DB ready (49 tables)
  path:  /var/lib/rankpilot/rankpilot.db
```

If that `path:` line shows a local default rather than the data directory, the
environment file is not being read. Fix that before accepting traffic: the app
would otherwise open a different file than the one you are looking at.

## 3. Routine deploys

```sh
cd /srv/rankpilot/app
git pull --ff-only
sudo -u rankpilot npm ci
sudo -u rankpilot SITE_URL=https://your-domain npm run build
sudo -u rankpilot npm test
sudo systemctl restart rankpilot
sudo npm run post-deploy:check
```

Run the deploy preflight by hand when you want to see the reasoning rather than
just the verdict:

```sh
sudo -u rankpilot npm run preflight:deploy
```

Every blocker names the variable that fixes it. A blocker is not something to
bypass by default; the `--allow-*` flags exist so a human can record accepting a
specific risk in the deploy log, and each one should have a reason attached in
whatever ticket prompted it.

## 4. Configuration

Full annotated list in `.env.example`. The ones a deploy cannot run without:

| Variable | Why it matters |
| --- | --- |
| `SITE_URL` | Canonical URLs, `sitemap.xml`, `robots.txt`. Set at build time. |
| `AUTH_SECRET` | Signs sessions. Missing, short or placeholder stops the process at boot rather than 500ing every request. |
| `RANKPILOT_DB_PATH` | Absolute path to the SQLite file. |
| `RANKPILOT_BACKUP_DIR` | Absolute path to the backup directory. |
| `BACKUP_PASSPHRASE` | Backups are encrypted; without it they would be plaintext containing user emails and password hashes. |
| `BACKUP_RETENTION_DAYS` | Without a retention limit a scheduled backup grows until it fills the disk. |
| `EMAIL_WEBHOOK_URL` | Password reset and email verification. Without it both return 503 and a user who forgets their password cannot recover their account. |
| `NODE_ENV` | `production`. Boot checks are skipped otherwise, including the secret validation. |

Provider credentials (Stripe, Google OAuth, Search Console, WordPress) are
optional in the sense that the app boots without them, but each feature reports
itself unavailable rather than failing open. Set the ones you intend to use; see
`.env.example` for the exact names and the docs for what each unlocks.

Path resolution has a single implementation, `databasePath()` in
`src/lib/db/db.ts`. The app, the preflight, the backup script and the init script
all call it. If you find yourself re-deriving `RANKPILOT_DB_PATH || DATABASE_PATH`
anywhere, do not; a second copy of that rule is how the backup script once started
backing up a different file than the application was writing.

## 5. Backups

Scheduled on the host by cron or a systemd timer. Two jobs:

```sh
0 3 * * * cd /srv/rankpilot/app && BACKUP_PASSPHRASE=... /usr/bin/npm run db:backup
30 3 * * * cd /srv/rankpilot/app && BACKUP_PASSPHRASE=... /usr/bin/npm run db:restore-test
45 3 * * 0 cd /srv/rankpilot/app && BACKUP_PASSPHRASE=... /usr/bin/npm run db:restore-test:retained
```

`db:restore-test` takes a snapshot, decrypts it into a temporary file, opens it,
then deletes the snapshot it created. It proves the backup code works.

`db:restore-test:retained` restores the newest snapshot that was **actually
retained**, rather than one it just made. That is the read-back a recovery plan
depends on, and it is the only one of the two that notices a scheduled job which
has been failing for a week. It reports the age of the snapshot it restored, and
fails rather than passing when the snapshot is encrypted and the passphrase is
not available.

A backup nobody has read back is a guess, not a backup: encryption, retention
and a truncated WAL all fail silently until the day you need the file.

Check the age of the newest snapshot from the admin dashboard or
`GET /api/admin/status`. Both read the same `BACKUP_STALE_HOURS` threshold, so the
dashboard and `post-deploy:check` cannot disagree about whether a backup is stale.

A snapshot left on the same volume as the database is not protection against
losing that volume. Copy snapshots off the host, and treat that copy as
unencrypted-at-rest sensitive: they contain user emails and password hashes.

## 6. Verifying a deploy

```sh
sudo npm run post-deploy:check
```

It exits non-zero when a blocking check fails, so it can gate a release. It
verifies that the service answers, that it can reach its database, that the
database and backup directories are on storage that survives a restart, and that
a recent backup exists.

It resolves the origin through the same `siteUrl()` the app uses, and prints the
origin it probed. Read that line. A green run against a local default verifies
the process, not the public site.

`/api/health/live` and `/api/health/ready` are separate on purpose: a server that
boots but cannot open the database is live, not ready, and a 200 from liveness
proves nothing. `npm run monitor:health -- --watch` polls both and exits non-zero
on a sustained outage, for cron or an external uptime service.

## 7. Recovering

- **Service will not start.** `journalctl -u rankpilot -n 50 --no-pager`. The
  boot path fails closed and says which variable is at fault; it does not half-start
  and then 500.
- **Restoring a snapshot.** Stop the service first, so nothing writes to the file
  you are replacing:
  ```sh
  sudo systemctl stop rankpilot
  # decrypt the snapshot you want into place, then:
  sudo -u rankpilot npm run db:init
  sudo systemctl start rankpilot
  sudo npm run post-deploy:check
  ```
  See `DISASTER_RECOVERY.md` for the full procedure and `BACKUP_RUNBOOK.md` for
  snapshot handling.
- **Suspect data corruption.** Copy the live file somewhere safe before touching
  it, and compare against the oldest known-good snapshot rather than the newest.

## 8. Troubleshooting

**Preflight blocks a path as ephemeral.** The database is on storage the platform
conventionally wipes. Move it to a persistent volume and update
`RANKPILOT_DB_PATH`.

**Preflight blocks a relative `RANKPILOT_DB_PATH`.** A relative path resolves
against whatever the working directory happens to be, which differs between a
build and a run. Use an absolute path.

**`db:init` prints a local default path.** The environment file is not being read.
Check its ownership and mode, and that `User=rankpilot` can traverse to it.

**Everything 500s but the port is open.** Almost always a boot check that should
have been fatal. The journal will name the cause; `assertProductionConfig()` is
meant to stop the process before it can hold a port open in that state.

**Backup job produces nothing.** Check `BACKUP_PASSPHRASE`, the backup directory's
existence and permissions, and that the retention value is a positive number.
`post-deploy:check` reports the backup directory and the newest snapshot age.
