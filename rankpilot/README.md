# RankPilot AI

**AI-Powered SEO, GEO, AEO & Social Growth Engine** — an AI Growth Operating System for Search, AI Discovery and Social Media.

> We optimize measurable factors and learn from real performance data. We never guarantee rankings, traffic, AI citations, views or virality.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · SQLite (`node:sqlite`, WAL) · zod · vitest — fully self-contained in this folder (own DB, own env, no dependencies on other projects in the workspace).

## Quick start

```bash
npm install
cp .env.example .env        # set AUTH_SECRET
npm run db:init             # creates data/rankpilot.db
npm run dev                 # http://localhost:3000
```

Quality gates:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Documentation

| Doc | |
|---|---|
| [01 System architecture](docs/01-system-architecture.md) | components, layers, decisions |
| [02 Product architecture](docs/02-product-architecture.md) | modules, tenancy, scoring, modes |
| [03 User journeys](docs/03-user-journeys.md) | activation, fix loop, create/social loops, UI states |
| [04 Sitemap](docs/04-sitemap.md) | all routes |
| [05 Database ERD](docs/05-database-erd.md) | tables, relationships, indexes |
| [06 API spec](docs/06-api-spec.md) | endpoints, envelope, errors |
| [07 AI architecture](docs/07-ai-architecture.md) | routing, grounding, guardrails, cost |
| [08 Crawler architecture](docs/08-crawler-architecture.md) | politeness, robots, pipeline, safety |
| [09 Social analytics](docs/09-social-analytics-architecture.md) | connectors, normalized metrics |
| [10 Security](docs/10-security-architecture.md) | auth, RBAC, tenant isolation, SSRF |
| [11 Infrastructure](docs/11-infrastructure-architecture.md) | runtime, jobs, scaling, observability |
| [12 MVP roadmap](docs/12-mvp-roadmap.md) | phases, quality gates |

## Structure

```
rankpilot/
  docs/            architecture set
  scripts/         db init
  src/app/         routes (marketing, auth, onboarding, app, api)
  src/components/  UI by feature
  src/lib/         domain: db, auth, crawler, seo, scoring, jobs, ai, security
  data/            SQLite database (gitignored)
```
