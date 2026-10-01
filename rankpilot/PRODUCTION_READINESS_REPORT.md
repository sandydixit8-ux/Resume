# RankPilot — Production Readiness Report

**Date:** 2026-09-27
**Commit:** none — working tree is untracked (`?? rankpilot/`)
**Verdict:** **Not ready for production launch.** The application code is in
good shape and every automated gate passes. What is missing is operational:
nothing is scheduled, nothing is off-site, nothing alerts, and email is not
configured. These are not code defects and cannot be fixed by writing more code.

---

## 1. Verified gate results

All run against the working tree as it stands. No result below is carried over
from an earlier run.

| Gate | Command | Result |
|---|---|---|
| Typecheck | `npm run typecheck` | exit 0 |
| Lint | `npm run lint` | exit 0 |
| Tests | `npm test` | **64 files, 639 passed**, 0 failed |
| Build | `npm run build` | exit 0 |
| Regression guards | `npm run guards:regression` | **36/36 present** |
| Migration | `npm run db:migration-test` | PASSED (4 assertions) |
| Encrypted restore | `npm run db:restore-test` | `integrity_check: ok`, **50 tables restored** |
| Aged snapshot read-back | `npm run db:restore-test:retained` | `integrity_check: ok`; refuses an encrypted snapshot with no passphrase, and reports staleness rather than passing |
| Smoke | `npm run smoke` | **11/11 checks passed** |

Restore verification detail, encrypted with a passphrase: `integrity_check: ok`,
50 tables, and the recovered database was asserted **bit-for-bit identical**
(sha256) to the snapshot, with a wrong passphrase correctly rejected. The
verification snapshot is removed afterwards, leaving the backup directory
unchanged at 6 files.

Side effects checked before and after the full gate:

- `data/rankpilot.db` user count: **99 → 99**. Tests do not touch the dev database.
- `backups/` snapshot count: **6 → 6**. No snapshot leak.
- Leftover temp directories: **0**.

---

## 2. Bugs found and fixed in this pass

### 2.1 Backup status read the wrong directory

`src/lib/backup-status.ts` read `BACKUP_DIR`. `scripts/backup.ts` writes to
`RANKPILOT_BACKUP_DIR`. The two names differ, so the staleness check reported
`never: true` — "there are no backups" — while backups sat on disk. The feature
existed to answer exactly that question, and it answered it wrongly, in the
direction that hides a disaster.

Fixed to read `RANKPILOT_BACKUP_DIR` (with `BACKUP_DIR` as a fallback). A test
now reads the *script's source* and asserts the variable names agree, so they
cannot drift apart again.

Mutation-verified: reintroducing `BACKUP_DIR` fails 13 of 15 tests; restored,
all 15 pass.

### 2.2 `db:restore-test` leaked a snapshot on every run

`npm run db:restore-test` takes a full encrypted copy of the database and, until
now, never deleted it. CI runs this command on every commit, and
`BACKUP_RETENTION_DAYS` is opt-in, so nothing ever pruned the result. Two
consequences:

1. **Disk growth without bound** — roughly 650 KB per run. Disk exhaustion is a
   failure mode `DISASTER_RECOVERY.md` explicitly plans for.
2. **It defeated the staleness check.** Those stray snapshots are recent, so
   `GET /api/admin/status` would report backups as fresh indefinitely, even if
   the real scheduled backup job had been dead for a month. A verification
   command was manufacturing the evidence that backups were working.

Fixed: `--verify` now removes the snapshot it created, on every exit path
including `process.exit(1)` failures, via a `process.on("exit")` handler.
`BACKUP_KEEP_VERIFY_SNAPSHOT=1` opts out.

Verified both directions against the real script: 6 → 6 files without the flag,
6 → 7 with it, restore still verified `integrity_check: ok` in both cases.

### 2.3 The runbook told operators to schedule the wrong command

`BACKUP_RUNBOOK.md` recommended `0 3 * * * ... npm run db:restore-test` as the
daily backup, on the reasoning that it "already takes and verifies a backup."
Combined with 2.2, following that instruction would have left an operator with
**zero retained backups**. The runbook now schedules `db:backup` daily and
`db:restore-test` weekly, and explains why verifying a snapshot taken seconds
earlier proves very little.

### 2.4 New regression coverage

`scripts/backup.e2e.test.ts` (11 tests) runs the real `scripts/backup.ts` against
a throwaway database and directory. It asserts the ciphertext is genuinely
encrypted — a canary row is not recoverable from it — that no plaintext is left
beside it, that verification leaves nothing behind, and that the opt-out flag
really does retain a file. It also covers the aged-snapshot read-back, which
verifies an existing days-old snapshot rather than one just taken, and asserts
that an encrypted snapshot with no passphrase available fails loudly instead of
passing: that is the failure an operator would otherwise discover mid-incident.

---

## 3. Known residue in the local dev database

`data/rankpilot.db` contains a table `isolation_probe` with one row, and holds
**50 tables where the application schema has 49**.

This is residue from *before* test isolation was fixed, when the suite opened
the real dev database and created that table. The current
`src/test/isolation.test.ts` does not do this — it writes to the scratch database
and asserts the repo file is byte-identical before and after. The residue was
never cleaned up because the dev database has not been modified without
approval.

It is inert, but it is also why the restore test reports 50 tables. Removing it
is a one-line `DROP TABLE` and is left for an explicit decision.

Separately, `backups/` holds 6 snapshots (3.74 MB) predating the 2.2 fix. They
are valid, restorable snapshots, not junk, so they have been left in place.

---

## 4. What is genuinely finished

- **Security**: SSRF/DNS/redirect handling, request validation, parameterised SQL,
  crawl and keyword bounds, quotas, tenant isolation, fail-closed RBAC, async
  scrypt, constant-time login comparison, XSS/CSV/PDF handling, trusted proxy
  config, IDOR scoping, session revocation on password reset and logout-all,
  hashed single-use tokens.
- **Auth flows**: password reset, email verification, resend — all enumeration-safe,
  with a single opaque failure reason.
- **Data protection**: AES-256-GCM encrypted backups with scrypt-derived keys,
  verified bit-for-bit restores, wrong-passphrase and tamper rejection,
  retention with a 7-snapshot floor, tenant and user erasure with recursive
  metadata scrub.
- **Operations**: split liveness/readiness, structured logging with secret
  redaction, owner-only status API, external health monitor, job retry/DLQ/lease
  reaping, fatal startup validation on `AUTH_SECRET`, root error boundary.
- **Performance**: SQLite concurrency benchmark clean at 1/5/10/25/50/100 writers
  (worst p99 7.02 ms at 100 writers). HTTP load test ~104 req/s at p99 486 ms
  recorded in the docs, with a later run at 133.3 req/s and p99 396 ms.
- **Test discipline**: 639 tests across 64 files, per-worker scratch databases, a
  suite that proves the real database is never opened, and 36 guards that fail the
  build if a previously-fixed bug's test is deleted or weakened.

## 5. What blocks launch

| # | Blocker | Why it cannot be closed in code |
|---|---|---|
| 1 | No scheduled backups | Needs a cron/systemd/container scheduler on a real host |
| 2 | No off-site copy | Needs an object-storage destination |
| 3 | No off-host `BACKUP_PASSPHRASE` | Needs a secret store the storage provider cannot reach. Losing it makes every encrypted backup unrecoverable |
| 4 | Nothing alerts | `backup.stale` and health are pollable, but no pager watches them |
| 5 | Email unconfigured | `EMAIL_WEBHOOK_URL` unset: password reset and verification return 503, so users have no self-service recovery |
| 6 | No error tracking | No Sentry, no log shipping, no aggregation. Client-only render errors are visible only in the browser console |
| 7 | Erasure is operator-only | No customer-facing request flow, no scheduled `deleted_at` queue drain |
| 8 | RPO/RTO unmeasured | Restore never exercised against a production-sized file |
| 9 | Remote CI never executed | `.github/workflows/ci.yml` has only run locally |
| 10 | Provider credential delivery | OAuth/Stripe/Search Console/CMS code is written and gated, but no live Google client, Stripe keys, Search Console, or CMS credentials exist, so nothing provider-backed runs outside tests |
| 11 | No deployment target | Never deployed anywhere; SQLite single-node constraint is deliberate and unvalidated in production |
| 12 | `FREE_AUDIT_RETENTION_DAYS=30` | A placeholder in `.env.example`, not an agreed compliance policy |

Items 1–4 are the ones that turn a missed backup or an outage from a surprise
into a non-event. They are configuration and hosting work, not engineering work,
and they are the reason this report says "not ready" despite a fully green gate.

## 6. Minimum set to reach launch

1. Deploy to a real host; run `db:backup` on a schedule from the documented cron.
2. Copy ciphertext off-site; store the passphrase separately from the storage.
3. Point an uptime monitor and an alert destination at `/api/health/ready` and at
   `backup.stale` on `/api/admin/status`.
4. Configure `EMAIL_WEBHOOK_URL` and confirm a reset email actually arrives.
5. Run one restore from the off-site copy and time it. That produces a real RTO.
6. Confirm the audit retention period with whoever owns compliance.

## 7. How to reproduce this report

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run guards:regression
npm run db:migration-test
BACKUP_PASSPHRASE=... npm run db:restore-test
npm run db:restore-test:retained
npm run smoke
```

Expected: 64 files / 639 tests, 36/36 guards, 11/11 smoke, `integrity_check: ok`,
and no change to the `backups/` directory. `db:restore-test:retained` reads back
the oldest available snapshot rather than one it just took, and is expected to warn
if the newest snapshot is older than `BACKUP_STALE_HOURS` — a warning means the
scheduled backup job is not running, not that the snapshot is unrestorable.
