# RankPilot AI — Infrastructure & Observability Architecture

## 1. Runtime topology

**MVP (single node)**

```
next dev / next start  ──┬── HTTP (marketing, app, API)
                         ├── in-process job worker (jobs table)
                         └── SQLite file data/rankpilot.db (WAL)
```

- One process keeps deployment trivial (VPS/Render/Railway/Fly).
- `scripts/init-db.ts` creates/verifies the DB for CI and fresh installs.
- The worker starts lazily inside the app process (`src/lib/jobs/worker.ts`), claims jobs with an atomic compare-and-set guarded by `locked_by`, reaps abandoned jobs on a lease timeout, and is a no-op when `RANKPILOT_WORKER=off`. A tick that throws is caught: an unhandled rejection would terminate the process and take the web server down with the worker.

**Target (scale-out)**

```
             ┌── next app (stateless) ×N ──┐
CDN/WAF ────┤                             ├── Postgres (primary + read replica)
             └── worker ×M (same image, ───┘        │
                        RANKPILOT_WORKER=on)        ├── Redis (BullMQ replaces jobs table)
                                                    └── object storage (raw HTML, report PDFs)
```

## 2. Environment & config

| Var | Purpose | Default |
|---|---|---|
| `RANKPILOT_DB_PATH` | SQLite path | `data/rankpilot.db` |
| `AUTH_SECRET` | session HMAC + credential encryption key material | required in prod |
| `OPENAI_API_KEY` | AI generation (optional; NullProvider fallback) | – |
| `CRAWLER_USER_AGENT`, `CRAWLER_TIMEOUT_MS`, `CRAWLER_MAX_PAGES` | politeness/limits | see `.env.example` |
| `RANKPILOT_WORKER` | `on/off` | `on` in dev, `off` for read-only replicas |
| `TRUSTED_PROXY`, `TRUSTED_PROXY_HOPS` | client-IP trust | unset unless behind your own proxy |

`CRAWLER_MAX_PAGES` (default `200`) is a **global safety ceiling**, not the per-plan limit. A crawl's real budget is `min(requested maxPages, plan.pagesPerCrawl, CRAWLER_MAX_PAGES)`, so the default value silently holds `pro`, `growth` and `agency` below their advertised page counts until an operator raises it. Raise it deliberately — it is the knob that protects the origin server.

### Client IP and rate limits

`X-Forwarded-For` is attacker-controlled unless a proxy you control sets it, and `next start` exposes no socket address to read. The app therefore **ignores forwarding headers unless `TRUSTED_PROXY=1`**. This matters because three limits key on the client address — login (10/15min), register (5/min) and the free audit (5/day) — and honouring a forged header let any caller mint a fresh bucket per request, which silently disabled all three.

Consequence of leaving it unset: `getClientIp()` returns `untrusted` for every direct client, so those three limits become **global caps** (5 free audits per day for the whole internet, 10 logins per 15 minutes). That is fail-closed rather than fail-open, but it is not a usable public deployment. Put the app behind a reverse proxy and set `TRUSTED_PROXY=1`; set `TRUSTED_PROXY_HOPS` to the number of proxies in the chain, and the client address is read from that many entries in from the right, so a client-supplied prefix is discarded.

Audit rows store the same value, so with the flag unset IP evidence reads `untrusted` rather than recording a forged address.

Config is read server-side only. `AUTH_SECRET` is validated at module load in production — missing, under 32 characters, or a placeholder throws immediately rather than starting with a weak signing key. (The other variables in the table above are optional and have documented defaults; there is no general required-variable sweep beyond `AUTH_SECRET`.)

## 3. Background jobs

- Table-backed queue: `jobs(type, payload, status, attempts, max_attempts, run_at, locked_by, error)`.
- Claim = atomic `UPDATE … WHERE status='pending'` after a `SELECT` + `changes===1` check → safe under concurrency. Note this is select-then-conditional-update, not a single atomic `UPDATE … LIMIT 1`.
- Retry: exponential backoff (5s → 15s → 60s), `max_attempts` per job (default 3), then `failed` with the error stored on the row.
- Lease: a job left `running` by a worker that died is reaped once `started_at` is older than `RANKPILOT_JOB_LEASE_MS` (default 2h — comfortably longer than the slowest legitimate crawl, since agency plans cap at 2000 pages). The reaper requeues it through the normal backoff path, so a lost worker cannot silently drop work or skew `queueDepth()`. Re-running is safe because crawls upsert pages by `url_key`. A requeued `crawl.run` also resets its `crawl_runs` row, which would otherwise block every future crawl for that website.
- `locked_by` records the claiming worker. There is **no heartbeat**: a job's lease is never renewed, so the lease must stay above the real worst-case job duration or healthy work gets reaped and crawled twice.
- Job types: `crawl.run` is the only enqueued type. A `schedules.tick` handler is registered but scheduling actually runs on a `setInterval` (`RANKPILOT_SCHEDULE_TICK_MS`), not the queue. Reports, social posts and audits run inline in their request, not as jobs.
- Timeouts: cooperative — each job checks elapsed time and a `cancelled` flag between pages so a user-cancelled crawl stops cleanly.
- Observability: structured JSON logs on stdout, plus `GET /api/admin/status` (owner-only) exposing queue depth and failed jobs. Alerting is not implemented. See section 6.

## 4. Database operations

- SQLite: WAL, `foreign_keys=ON`, `busy_timeout=5000`, nightly checkpoint; backups via `.backup` API to `data/backups/`.
- Migrations: idempotent `schema.sql` + ordered `MIGRATIONS[]` in `_migrations` (zero-downtime additive policy).
- Postgres path: SQL is kept portable (no SQLite-only functions in shared queries); repository layer isolates dialect differences; migrate with `pgloader`/custom script, then switch `src/lib/db` drivers.

## 5. Performance budgets

| Surface | Budget |
|---|---|
| Landing/TTI | LCP < 2.5s on 4G, no client JS for static sections |
| Dashboard API | p95 < 300ms (indexed queries, ≤1 N+1) |
| Crawl progress poll | 1.5s interval, cheap counter query |
| Large crawl | analysis streamed per-batch; UI never loads >200 rows (paginated) |
| Reports | always async job → file |

Techniques: React Server Components (no client fetch waterfalls), list pagination + server-side filters, `CREATE INDEX` per ERD, response compression, long-cache static assets, SQLite prepared statements.

## 6. Observability

**Current state: structured logging exists; alerting does not.** `src/lib/logger.ts` emits one JSON object per line to stdout (`ts`, `level`, `msg`, plus context), redacting secret-looking keys at any nesting depth. There is still no alerting, no error-tracking service, and no request-perf instrumentation.

| Signal | Status | Implementation |
|---|---|---|
| App logs | Implemented | `log.info/warn/error` → single-line JSON on stdout. Secret-looking keys (`password`, `token`, `*_secret`, `api_key`, `cookie`, …) are replaced with `[redacted]`, and a circular or unserialisable field degrades to a note instead of throwing. |
| Worker events | Implemented | Job completed / failed / no-handler / reaped, with `jobId`, `type`, `tenantId`, `attempt`, `durationMs`, and the error name+message. A `tick()` that throws is logged, then re-thrown for the interval's catch. |
| Auth events | Implemented | `auth.login.ok` and `auth.login.failed` (with a `reason` of `no_such_user`, `deleted`, or `bad_password`). The email and password are never logged — the user id is enough to correlate. |
| Health | Implemented | `GET /api/health` → database reachability. Returns **503** when the database is unreachable, so load balancers and container health checks do not keep routing to a broken instance. Reports the app version, not a migration version. |
| Operational status | Implemented | `GET /api/admin/status` (owner-only, `admin:read`) → queue depth, failed job count, failed crawl count, the 50 most recent failed jobs, stuck `queued`/`running` crawls, rate-limit telemetry, and `configWarnings` / `emailConfigured`. |
| Data erasure | Implemented (API) | `POST /api/admin/erasure`, owner-only, dry-run by default. No customer-facing request flow, no scheduled drain. |
| Crawl counters | Implemented (DB only) | `crawl_runs` stores pages discovered/analyzed, issues, keywords, bytes, avg response time, and the error string. Surfaced as counts via `/api/admin/status`. |
| AI usage/cost | Implemented (DB only) | `ai_usage` rows per call. No rollups or per-tenant spend report yet. |
| Error tracking | **Partial** | A root error boundary (`src/app/global-error.tsx`) catches unhandled render errors and logs the digest. No `server_error` sink, no Sentry adapter, no client-only error visibility. |
| Request/slow-query perf | **Not implemented** | No per-route duration or slow-query logging. |
| Backup freshness | Implemented (read-only) | `src/lib/backup-status.ts`; surfaced as `backup` on `GET /api/admin/status`. Reports whether a recent snapshot exists. Nothing alerts on it. |
| Alerting | **Not implemented** | Nothing pages or notifies a human. `/api/health` and `/api/admin/status` are pollable, but no one polls them yet. The monitor only tells you when something is already down. |

**Remaining gap before relying on this unattended:** logs now exist, but a 3am failure is still only recorded, not raised. The minimum viable addition is an external check that alerts on a sustained non-200 from `/api/health` or a non-zero failed-job count from `/api/admin/status`.

**Admin status API (implemented), dashboard (not)**: `GET /api/admin/status` is owner-only (`admin:read`, which `admin` does *not* hold) and returns queue depth, failed job and crawl counts, the 50 most recent failed jobs, stuck queued/running crawls, rate-limit telemetry, and `configWarnings` / `emailConfigured` (section 6a). There is no `/admin` page and no visual dashboard; that remains a planned surface.

## 6a. Data erasure endpoint

`POST /api/admin/erasure` is the operator-facing entry point to `purgeTenant`. It exists because the erasure library previously had no way to be reached: a request could arrive and then sit unanswered until someone ran a script by hand, which is not an erasure process.

Safety properties, because this deletes a customer's entire account:

- **Owner-only**, on `billing:write`. A tenant `admin` cannot erase their own org, so a compromised admin session cannot destroy the data of the business that owns it. `admin:read` is deliberately not sufficient.
- **Dry run by default.** Without `confirm: true` the response lists exactly what would be deleted and anonymized, and nothing is touched. Destruction is always a second, informed step.
- **`confirmTenantId` must repeat `tenantId`**, so a stale tab or a mis-copied request cannot delete the wrong account. A mismatch is audited as `erasure.rejected_mismatch`.
- **Refuses when cascades cannot fire.** If foreign key enforcement is off, the endpoint returns `cascades_disabled` rather than proceeding, because deleting the organization row alone would orphan every child row while reporting success.
- **Rate limited** to 5/minute per caller, because a loop against it is a denial of service.
- **Audited** at every stage: `erasure.requested`, `erasure.rejected_mismatch`, `erasure.failed_cascades_disabled`, `erasure.completed`, with per-table counts.
- Audit rows are **retained and anonymized, not deleted**, so the record of the erasure survives it.

Not implemented: a customer-facing "delete my account" request flow, and a scheduled worker that drains the `deleted_at` queue automatically. An owner must invoke this.

## 6b. Startup preflight

`assertProductionConfig()` is **fatal**: a missing, short, or placeholder `AUTH_SECRET` stops the process. A server without it cannot sign a session, so every session-dependent request would 500 while the process reported "Ready" and held the port open — and systemd, Docker and Kubernetes all treat an open port as healthy. `src/lib/runtime-start.test.ts` verifies this by spawning the boot path as a child and asserting the exit code, including a case proving a *valid* secret does not exit, so the guard cannot decay into always-fail.

`productionConfigWarnings()` is **not** fatal, because the two problems have different consequences:

| Condition | Severity | Reason |
|---|---|---|
| `AUTH_SECRET` missing/short/placeholder | **Fatal** | The app cannot function at all |
| `EMAIL_WEBHOOK_URL` unset | Warning | Anonymous audits and paid traffic work without email; blocking boot would prevent releases over an integration not yet chosen. But the cost is every user who forgets a password being permanently locked out with no indication of why. |
| `EMAIL_WEBHOOK_URL` non-https | Warning | Would carry credentials in clear text |
| `BACKUP_PASSPHRASE` unset | Warning | Backups silently fall back to plaintext |

Warnings are logged at boot (`WARNING: RankPilot started with incomplete configuration. ...`) **and** returned as `configWarnings` on `GET /api/admin/status`, because a line in a deploy log is easy to miss while the status endpoint is what an operator actually looks at when something is wrong. Both are empty outside production, so development and test are not nagged. No email provider is configured, so this warning is currently live.

**Health probes (implemented)**: `/api/health/live` (process only, never touches the database, so a database blip cannot cause a restart loop), `/api/health/ready` (503 when the database is unreachable), and `/api/health` kept as an alias of `/ready` for existing probes. `scripts/smoke.mjs` asserts all three against a real server.

**Request correlation (partial)**: `src/proxy.ts` sanitizes an inbound `x-request-id` (or mints one) and returns it on every response, so a log line can be tied to a user report. `withRequestLogging()` emits one structured line per request with method, route, status, duration, and request id — but it is currently applied only to the operationally critical routes, not to every API handler.

**Uptime monitoring (implemented)**: `npm run monitor:health` (`scripts/monitor-health.ts`) polls `/api/health/live` and `/api/health/ready`, prints one line per check, and exits non-zero on failure so cron, systemd, Docker `HEALTHCHECK`, or an external uptime service can act on it. `--watch` polls forever and reports consecutive failures, distinguishing a blip from a sustained outage. It re-implements the checks against the wire format rather than importing the health module, so a bug in the app cannot also disable the thing watching it, and it reports only status and error code so its output is safe for a public status page. Exercised in CI via the smoke test.

**Still not implemented:** no error-tracking service (Sentry or equivalent), no log shipping or aggregation, no alerting rules, no on-call rotation. The monitor tells you when something is already down; nothing pages a human.

**Crash reporting (partial)**: `src/app/global-error.tsx` is the root error boundary. Without it an unhandled render error produced Next.js's built-in page with no recovery path. It renders its own `<html>`/`<body>` (it replaces the root layout), offers a retry, and shows only the error *digest* — never `error.message`, which can contain file paths, SQL, or provider detail. The message goes to the browser console.

Two honest limits. The boundary logs the **digest**, which is the reliable correlation key for a server-rendered error because Next.js prints the same digest in the server log; it does **not** log a usable request id, since the request id `src/proxy.ts` sets is a response header and a client component that has replaced the root layout cannot read it. A client-only render error has no server-side log at all, so with no error tracking service wired up those are only visible in the browser console. The visible copy deliberately avoids claiming the user's data is unaffected, because a render error can follow a committed write; it tells the reader to check for a duplicate instead.

## 7. CI / release

- **CI: implemented** in `.github/workflows/ci.yml`. Two jobs. `verify` runs install → lint → typecheck → test → build → migration test → backup/restore verification (plaintext *and* encrypted) → smoke test. `regression-guards` runs `scripts/check-regression-guards.mjs`, which fails the build if a guard for a previously-fixed bug has been deleted or weakened, then re-runs the suite.
- Build runs after typecheck because `tsc --noEmit` uses an incremental cache that has missed real type errors here before; `next build` is authoritative.
- **Fail fast at boot**: `src/instrumentation.ts` calls `startRuntime()` in a dynamic import (kept out of the Edge bundle, where `process` does not exist). If startup checks throw — a missing `AUTH_SECRET`, for example — the process logs the cause and `process.exit(1)`. Without this, a failed `register()` became an unhandled rejection: the server still printed "Ready", still bound the port, and answered every request with 500, so systemd, Docker, and Kubernetes all reported a healthy instance while it failed every request.
- Trunk-based, small commits; migrations reviewed like code.
- Deploy: build → run `scripts/init-db.ts` → start. Rollback = previous image. Migrations are additive-only, so the older image still runs against the newer schema.
- **Not implemented:** no preview-environment deploys, no release tags, no automatic rollback, no coverage thresholds, no remote execution of these workflows has been observed yet.

## 7b. Test database isolation

**`npm test` never touches the developer's working database.** This was not true for a long time, and it caused real damage.

`getDb()` falls back to `data/rankpilot.db`, and nothing in the test configuration overrode that. So the suite opened the actual local development database, and:

1. **It mutated real data.** Running the tests left users, organizations, memberships, jobs and audit rows behind. Any test that clears a table to set up its scenario could delete actual saved work.
2. **Suites raced each other.** Vitest runs test files in parallel against one shared SQLite file, so a test that deleted from `users` broke the password-reset suite with a `FOREIGN KEY constraint failed`. The failure pointed at the wrong file, because the actual cause was in a different suite running concurrently.

The fix gives every test file its own database:

- `src/test/global-setup.ts` (`globalSetup`) creates one scratch directory under the OS temp dir and removes it when the run finishes. Cleanup lives here because `process.on("exit")` does not reliably fire inside vitest worker threads — an earlier attempt using it leaked 75 directories per run.
- `src/test/setup-db.ts` (`setupFiles`) points `RANKPILOT_DB_PATH` at `<scratch>/worker-<id>.db`. `setupFiles` rather than `globalSetup` for the path because it runs inside the worker, and it must execute before any module calls `getDb()`, which caches the connection on first use.
- Five suites that want a database of their own (`tenancy`, `analyze`, `ai`, `lease`, `xtenant`) place their file inside the same scratch directory. They previously called `mkdtempSync` directly and leaked a directory every run.
- `rmSync` uses `maxRetries`/`retryDelay`, because on Windows a worker's SQLite handle can still be closing when the run ends and deleting a locked file fails with `EBUSY`.
- Windows file locking is also why the real suite uses `pool: "threads"`; the default `forks` pool is serialised by SQLite locks.

`src/test/isolation.test.ts` guards the guard: it asserts the connection is not the repo database, that it lives under the temp dir, that writing to it does not change a byte of `data/rankpilot.db`, and that dedicated-database suites stay inside the scratch dir. **Mutation-verified**: removing `setupFiles` fails 2 of these tests.

Side effect worth knowing: tests can no longer rely on data already in the local database. That is the point.

## 8. Backup & DR

Full procedures live in [`BACKUP_RUNBOOK.md`](../BACKUP_RUNBOOK.md) and [`DISASTER_RECOVERY.md`](../DISASTER_RECOVERY.md). What is true today:

- **Implemented:** `npm run db:backup` writes a consistent snapshot via SQLite `VACUUM INTO` — not a file copy, which can capture a torn page mid-transaction. `npm run db:restore-test` restores the snapshot to a scratch path and asserts size, `PRAGMA integrity_check`, and per-table row counts. Run against a real database (48 tables, 147 users): passed.
- **Implemented:** backups are encrypted with AES-256-GCM, keyed by scrypt from `BACKUP_PASSPHRASE` (`scripts/backup-crypto.ts`, no new dependency). **Conditional:** if `BACKUP_PASSPHRASE` is unset, `npm run db:backup` writes a plaintext `.db` and prints a warning, so "encrypted at rest" is only true once that variable is set in the environment that actually runs backups. Routine backups encrypt too, not just restore verification. The plaintext snapshot is deleted once the ciphertext is written. The restore path decrypts exactly as a real disaster would and asserts the recovered database is **bit-for-bit identical** (sha256) to the one that was backed up, and that a wrong passphrase is rejected. Tampering fails closed on the GCM auth tag.
- **Implemented:** `BACKUP_RETENTION_DAYS` prunes old snapshots, with an absolute floor of the 7 most recent. A pruning bug cannot empty the backup directory.
- **Implemented:** `npm run db:migration-test` builds a legacy-shaped database and runs the real migration over it, proving the upgrade path adds the new column, creates the index, and backfills existing rows. This catches the failure mode where a column is added to `schema.sql` alone, where `CREATE TABLE IF NOT EXISTS` makes it a no-op for existing databases.
- **Not implemented:** no scheduled backups, no off-site copy, no point-in-time recovery. Encryption is now in place, but a passphrase alone does not protect against losing both the file and the passphrase.
- **Backup staleness is now visible, but not paged.** `src/lib/backup-status.ts` inspects the snapshot files on disk and reports age, count, and whether the newest is encrypted. `GET /api/admin/status` returns it under `backup`, so a backup job that has silently died shows up as `stale: true` instead of being discovered on the day of a restore. This reads the filesystem rather than trusting a database row, because the row would be written by the same process that might be failing. `BACKUP_STALE_HOURS` tunes the threshold (default 26, so a daily job that runs slightly late is not a false alarm). Three deliberate details: a `restore-check-*.db` left by `db:restore-test` is **not** counted; `db:restore-test` deletes the snapshot it created, because CI runs it on every commit and those stray files are recent enough to make a dead backup job look permanently healthy; and a missing directory reports `never: true`, which is a different problem from `stale: true`. Nothing watches this value — no alert fires when it goes bad.
- **Fixed, and worth recording because it was silently wrong:** `backup-status.ts` originally read `BACKUP_DIR` while `scripts/backup.ts` reads `RANKPILOT_BACKUP_DIR`, so the status endpoint would have reported `never: true` while backups sat on disk — the check would have reported "no backups" about the one thing it existed to verify. A test now asserts the two agree by reading the script's source, so they cannot drift apart again.
- **Fixed: `db:restore-test` leaked a snapshot per run.** It took a full encrypted copy of the database and never removed it. Since CI runs it on every commit and `BACKUP_RETENTION_DAYS` is opt-in, nothing ever pruned them. That grew the backup directory without bound — disk exhaustion is a failure mode `DISASTER_RECOVERY.md` explicitly plans for — and it defeated the staleness check above. `scripts/backup.e2e.test.ts` now covers this end to end, including that the ciphertext really is encrypted (a canary row cannot be recovered from it) and that no plaintext is left beside it.
- **Proposed, not agreed:** RPO 24h (daily snapshots), RTO ~15 min. Neither is measured against a production-sized file.
- **Data erasure: implemented as a library** in `src/lib/privacy/erasure.ts`. `purgeTenant` deletes the organization row, which cascades across every table declaring `tenant_id REFERENCES organizations(id) ON DELETE CASCADE`, and explicitly deletes the two tables that carry a `tenant_id` with **no** foreign key (`jobs`, `ai_usage`) and would otherwise be orphaned. `eraseUser` removes one person's sessions, tokens, and memberships.
  - Audit logs are **anonymized, not deleted**: `user_id`, `ip`, and identifying keys inside the caller-supplied `meta` blob are nulled or stripped, while the event itself is kept. Destroying the security log on request would also destroy the evidence needed to answer the next request.
  - The `meta` scrub is **recursive** with a depth ceiling, because a top-level-only pass silently left `meta.contact.email` and `meta.targets[0].userAgent` intact while still recording the erasure as done. Mutation-verified: reverting to a top-level-only scrub fails the nested-PII test.
  - Audit anonymization keys off **captured row ids**, not `WHERE user_id = ?`. `user_id` is itself nulled, so an update ordered `user_id` → `ip` left every IP address in place. Mutation-verified: reverting to the order-dependent update fails the IP test.
  - `assertCascadesEnabled()` refuses to run when `PRAGMA foreign_keys` is off, because a purge with cascades disabled would report success while leaving every child row behind. Mutation-verified: removing the guard fails 2 tests.
  - 18 tests. Reachable at `POST /api/admin/erasure` (see section 6a). Still no self-serve customer-facing erasure request flow and no scheduled worker that acts on the `deleted_at` queue; an owner must call the endpoint.
  - `FREE_AUDIT_RETENTION_DAYS` remains a separate, strictly scoped automatic deletion for anonymous free audits.

## 8a. Measured SQLite write concurrency

Run `npm run bench:sqlite`. It opens a temporary WAL database per level, performs 20 writes per writer, then verifies the row count equals the successful write count so silent data loss cannot be reported as a pass.

| Concurrent writers | Writes | Failed | Wall (ms) | p50 | p95 | p99 | max |
|---|---|---|---|---|---|---|---|
| 1 | 20 | 0 | 55 | 1.25 | 7.61 | 7.61 | 7.61 |
| 5 | 100 | 0 | 170 | 0.75 | 4.14 | 7.99 | 7.99 |
| 10 | 200 | 0 | 358 | 0.83 | 4.03 | 6.68 | 8.49 |
| 25 | 500 | 0 | 848 | 0.80 | 3.64 | 6.72 | 8.79 |
| 50 | 1000 | 0 | 1751 | 0.82 | 4.23 | 7.07 | 9.00 |
| 100 | 2000 | 0 | 3683 | 0.83 | 3.76 | 7.02 | 12.61 |

Measured on a single Windows host, `busy_timeout=5000`, WAL enabled, small short-lived transactions.

**Conclusion: no write failed up to 100 concurrent writers and p99 stayed near 7 ms.** On this evidence SQLite is **not** the bottleneck at MVP-to-early-growth scale, and migrating to PostgreSQL is **not justified today**. That reverses the earlier assumption in this document that a migration would be required.

Caveats that bound the result: single-process on one machine; it does not model long-running transactions or the crawler's memory-heavy work; and it says nothing about **multi-node** deployment. Multiple app nodes cannot safely share one SQLite file over a network filesystem, so horizontal scale-out still requires PostgreSQL or per-node databases. Revisit if sustained write latency rises or a second writer node is added.

## 8b. Measured HTTP load

Run `npm run bench:http` with the production server up. 800 requests at concurrency 16, mixed across the endpoints a first-time visitor actually hits (`/`, `/pricing`, both health probes, and an anonymous `/api/auth/me`).

| Metric | Value |
|---|---|
| Throughput | ~104 req/s |
| p50 | ~127 ms |
| p95 | ~295 ms |
| p99 | ~486 ms |
| max | ~826 ms |
| Unexpected statuses | 0 (200 x645, 401 x155) |

A 401 from `/api/auth/me` is the endpoint working, so the scoring compares against each endpoint's expected status rather than treating `>= 400` as failure — otherwise correct auth refusals would be reported as errors. Verified to go red: against a server that passes `/api/health/live` but 500s everything else it reports 76.67% unexpected statuses and exits non-zero.

**Conclusion: single-node capacity is not the constraint at this scale.** No endpoint needed a database write path under load, which is the expected shape for mostly-anonymous traffic.

Caveats, and these matter: this is a **closed-loop generator with no think time**, so it is a saturation figure and not an "N concurrent users" claim. It is single-process on one machine. Latency here is dominated by first-request page rendering and cold caches, not steady-state cost, so treat p99 as indicative only. **No load test has been run against an authenticated, write-heavy workload** — crawling, AI calls, and report generation are entirely untested under concurrency, and those are the paths most likely to saturate.

## 9. Cost controls

- Crawl: page/byte quotas per plan; per-host politeness prevents runaway bandwidth.
- AI: pre-call quota + per-call cost logging + monthly cap alerts.
- Hosting: single node until CPU/queue-depth thresholds trigger worker extraction (documented trigger: queue depth > 50 sustained 10 min).
