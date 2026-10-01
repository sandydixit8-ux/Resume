# RankPilot AI — System Architecture

Status: MVP (Phase 1) · Stack: Next.js 16 (App Router) + TypeScript + SQLite (`node:sqlite`) + Tailwind v4

## 1. Style

A **modular monolith**: one Next.js application containing clearly bounded modules, plus an in-process background worker for long-running jobs (crawl, analysis, generation). This keeps local development and deployment trivial while preserving extraction paths (crawler service, AI gateway, queue) for scale.

```
┌──────────────────────────────────────────────────────────────────┐
│                         Next.js App                              │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────────┐  │
│  │ Marketing    │  │ App (auth'd) │  │ API (Route Handlers)    │  │
│  │ landing,     │  │ dashboard,   │  │ /api/*  zod-validated   │  │
│  │ free audit   │  │ websites,    │  │ envelope {ok,data|error}│  │
│  │ pricing      │  │ issues, AI   │  │ rate-limited            │  │
│  └─────────────┘  └──────────────┘  └────────────┬────────────┘  │
│                                                   │              │
│  ┌────────────────────────────────────────────────▼────────────┐ │
│  │ Domain layer (src/lib)                                      │ │
│  │  auth/  db/  http  plans  usage  audit  security            │ │
│  │  crawler/  seo/  aeo/  geo/  scoring/  content/  social/    │ │
│  │  ai/ (router, prompts, validation, cost)                    │ │
│  └────────────┬───────────────────────────────┬────────────────┘ │
│               │                               │                  │
│  ┌────────────▼───────────┐   ┌───────────────▼───────────────┐  │
│  │ Job runner (in-proc)   │   │ SQLite (WAL, FK on)           │  │
│  │ jobs table + worker    │   │ data/rankpilot.db             │  │
│  │ retry/timeout/status   │   │ → Postgres at scale           │  │
│  └────────────────────────┘   └───────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
        │ fetch (robots-aware, SSRF-guarded, rate-limited)
        ▼
  User's website / sitemap.xml / external APIs (GSC, GA, social)
```

## 2. Layers

| Layer | Location | Rules |
|---|---|---|
| Presentation | `src/app/**` (pages), `src/components/**` | Server Components by default; client components only for interactivity. No direct SQL. |
| HTTP | `src/app/api/**/route.ts` | Parse+validate with zod, authenticate, authorize, call domain, return envelope. Never contain business logic. |
| Domain | `src/lib/**` | Pure functions where possible (scoring, parsers, generators) so they are unit-testable without HTTP. |
| Persistence | `src/lib/db/**` | `node:sqlite` + parameterized SQL only. Every tenant table carries `tenant_id`. |
| Async | `src/lib/jobs/**` | Durable `jobs` table, in-process worker, retries with backoff, job status exposed to UI. |
| External | `src/lib/ai/**`, `src/lib/integrations/**` | All external calls behind adapters with timeouts, cost tracking, and graceful "data unavailable" fallbacks. |

## 3. Key technical decisions

1. **SQLite now, Postgres later.** MVP runs anywhere with zero services. All SQL is ANSI-ish (no SQLite-only features in domain queries beyond `json_extract`), and IDs are prefixed strings (`ws_…`, `run_…`) so they remain portable. Migration path documented in `11-infrastructure-architecture.md`.
2. **In-process job runner, not Redis/BullMQ (MVP).** A `jobs` table + `setInterval`-style worker with claim semantics gives durability across restarts. The job interface (`enqueue/claim/complete/fail`) is queue-agnostic so BullMQ can replace it without touching callers.
3. **Stateless HMAC session cookies + revocable session rows.** Fast, no server session store; a `sessions` table gives logout-everywhere and future 2FA step-up.
4. **Zod at every boundary.** Request bodies, query params, AI outputs, imported content — all schema-validated before touching the domain.
5. **Pure scoring engine.** Every score is computed from a checklist of weighted checks in code (`src/lib/scoring`), never a black box, so the UI can explain "why 76".
6. **AI behind a router with an output validator and a no-fabrication guard.** If a required fact (volume, rank, traffic) is absent from project data, the output must say "Data unavailable."

## 4. Request/data flow (audit example)

1. User submits URL → `POST /api/websites` → validated, normalized, SSRF-checked, row created.
2. `POST /api/websites/:id/crawl` → quota check → `crawl_runs` row (`queued`) → `jobs` enqueue `crawl.run`.
3. Worker claims job → discovers URLs (sitemap + robots + link frontier) → fetches with rate limit → parses into `pages`.
4. Analyzers run over `pages` → `seo_issues`, `questions`, `keywords`, `scores` written in one transaction per phase.
5. UI polls `GET /api/crawl-runs/:id` → progress (pages discovered/analyzed, issues found) → dashboard renders score + top issues + actions.

## 5. Environments

| Env | DB | AI | Notes |
|---|---|---|---|
| local | `data/rankpilot.db` | optional key | `npm run dev` |
| test | temp file per run | disabled | vitest |
| production | Postgres (later) / SQLite + volume | required key | see infra doc |

## 6. Repository layout

```
rankpilot/
  docs/                 architecture set (this file + 11 more)
  scripts/init-db.ts    creates/verifies the database
  src/app/              routes: marketing, auth, app, api
  src/components/       UI by feature
  src/lib/              domain modules (db, auth, crawler, seo, scoring, jobs, ai)
  data/                 SQLite file (gitignored)
```
