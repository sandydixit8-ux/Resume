# O. Deployment Architecture

## Environments
- `local` (next dev + supabase local or remote) 
- `staging` (Supabase project + Vercel preview, `NEXT_PUBLIC` build env)
- `production` (Vercel + managed Supabase, strict env separation)

## Topology
```
Client (mobile/desktop PWX) 
  -> Vercel Edge Network (static + serverless API routes, middleware auth)
     -> Next.js SSR + Server Actions (RLS-enforced DB access via supabase-js)
     -> Supabase: Postgres (RLS, migrations) · Auth · Storage (S3-compatible)
        Realtime · Edge Functions (optional)
  -> Background jobs: Vercel Cron / queued worker (bg worker container in prod
     via Docker on hosted runner) for WhatsApp, email, exports, campaigns, AI
  -> Paid provider APIs via server-only env keys; mock providers in dev
```

## Key decisions
- Single Next.js app keeps SSR + API + server actions simple; jobs isolated to
  a worker service so main request path stays fast.
- DB migrations applied via `supabase db push` in CI, never at runtime.
- Object storage for files; Postgres only for metadata.
- Realtime via Supabase Realtime (websockets), gracefully degraded to polling.

## Docker
`Dockerfile` (Next standalone) + `docker-compose.yml` for local stack
(next + optional local supabase/pg). Worker image separate (`worker/`) for jobs.

## CI/CD (GitHub Actions)
On push/PR:
- lint + typecheck
- unit tests (vitest)
- integration tests against a test Supabase project (RLS, auth, APIs)
- build (next build)
- `npx supabase db push` on main to staging DB
- e2e (Playwright) against preview URL
On main release: build + deploy (Vercel CLI token) + migration apply + health
check.

## Observability
- Structured logs (server only) + error tracking (e.g. Sentry) `SENTRY_DSN`.
- Latency metrics for API + jobs; failed webhook tracker; job retries/DLQ.
- `/platform/health` shows org count, job queue depth, failed jobs, DB latency.
- Alert thresholds configured on SLOs.

## Config & secrets
- Env per environment: `.env.local.example`. Secrets stored in the deploy
  platform (never in git).
- Feature flags for progressive rollouts.

## DR / backups
- Daily automated Postgres backups + point-in-time recovery (managed Supabase).
- Storage replicated by provider.
- Restore runbook + staging restore test.