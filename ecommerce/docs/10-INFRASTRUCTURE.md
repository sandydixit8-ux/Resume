# Infrastructure Architecture

## 1. Environments

| Env | Purpose | Hosting | Data |
|---|---|---|---|
| Local (dev) | daily dev, tests | docker compose: api + postgres + redis + mailhog (fake SMTP) + local storage | disposable Postgres |
| Preview | per-PR | ephemeral (Render PR envs or Docker on runner) | ephemeral DB |
| Testing | CI | GitHub Actions: postgres service + redis service | per-run |
| Staging | pre-release verification | mirror of prod topology, smaller sizes | seeded anonymized |
| Production | live | see topology | managed, backed up |

Environments: config via `.env.{env}` + secrets manager. No code-level environment forks.

## 2. Production topology — MVP (cost-optimized)

```
[User] → [Cloudflare: DNS, CDN, WAF] → [Render/Railway: web (storefront+admin+api)]
                                        → [worker process (BullMQ)]
   → components:
      - Managed PostgreSQL 16 (PITR, 30-day backup, 2 minimal nodes)
      - Managed Redis (Upstash) or Redis Cloud
      - Cloudflare R2 bucket (images/videos) + CDN
      - External: Razorpay, Shiprocket, Email (Resend/SES), SMS (MSG91)
      - Sentry + structured logs + UptimeRobot
   Backups: managed PITR; nightly R2 snapshot of uploaded media.
```

Cheaper alt: 1–2 Hetzner VPS ($10–20) running Docker (web+worker) + managed Postgres/Redis in
cloud. Cost table in `11-COST.md`. Decision needed at Phase 1 start.

## 3. Scale topology (Phase 8)

- Stateless web/API horizontal; worker pool scaled by queue depth.
- Managed k8s (EKS/GKE) or Cloud Run; application per-function metrics.
- Read replicas for reporting/search/marketing queries.
- Search service (Typesense cluster); event pipeline for analytics.
- Object storage remains R2/S3 + CDN; WAF/rate limits at edge.

## 4. CI/CD (GitHub Actions)

- Branches: `main` (prod), `develop`/`staging`, feature branches → PRs.
- PR gates: lint + typecheck + unit + integration + e2e (Playwright) + dependency audit +
  secret scan (gitleaks) + container build. Required status checks on protected `main`.
- Deploys: merge to `main` → build image → migrate DB (forward-only, gated) → deploy web+worker
  → smoke checks. Rollback: previous image; migrations are backward-compatible-through-2-releases.
- Scheduled: bundle audit, restore-test, backup check.

## 5. Deployable units (each independently scaled/deployed by config flags)

1. `web` — storefront Next.js (SSR/ISR).
2. `admin` — admin Next.js app.
3. `api` — NestJS (HTTP + serves /api/v1).
4. `worker` — BullMQ consumer (emails, images, index, analytics, reconciliation, shipping sync).

## 6. Observability & alerting

- Logs: pino JSON → log drain (Render/Railway) + Sentry for exceptions.
- Metrics: request latency/error rates, job failure, payment fail ratio, rate-limit hits
  (later Prometheus→Grafana; MVP: Sentry + uptime + dashboard of health/counters).
- Alerts: payment failure spike, job DLQ depth, 5xx spike, auth failure spike, inventory
  conflicts, checkout failures, site down.

## 7. Backups & DR (see also `07-DATABASE.md` section 16)

- RPO ≤ 1h (PITR), RTO ≤ 4h MVP. Runbook: restore managed snapshot → point storage to R2 →
  smoke test → swap DNS. Quarterly restore drills.

## 8. Environment variables (grouped; exact list in Phase 1 `.env.example`)

Database URL, Redis URL, JWT secrets, Razorpay keys, Shiprocket keys, Resend/SES keys, SMS keys,
R2 keys, CDN domain, Sentry DSN, app URLs, admin RBAC bootstrap, feature flags.