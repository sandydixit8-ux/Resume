# Technology Stack — Selection, Alternatives, Rationale

Principles: performance, developer productivity, ecosystem, cost, security, scalability,
maintainability, availability, long-term business needs. No fashion-driven choices.

## 1. Recommended Stack (summary)

| Area | Choice | Alternatives considered | Why (short) |
|---|---|---|---|
| Monorepo | pnpm + Turborepo | Lerna, Nx | Fast installs/builds, dependency isolation, one repo for web+admin+API+packages |
| Language | TypeScript everywhere | Python, Go | Shared types web↔API, strong typing, one language across the org |
| Frontend (web+admin) | Next.js 14 App Router | Nuxt, SvelteKit, Remix | SSR/ISR for SEO, huge ecosystem, Vercel-compatible or self-host |
| UI/design system | Tailwind + shadcn/ui (Radix) | MUI, Ant Design | Custom premium look, accessible primitives, tokens-based |
| Client state | TanStack Query + Zustand | Redux, Jotai | Server cache + tiny local state (cart/auth), minimal global state |
| Backend API | NestJS (modular monolith) | Django, Laravel, Express | Enforced module boundaries, DI, TS-typed, testable, extraction-friendly |
| ORM | Prisma | Drizzle, Kysely | Productive, typed, migrations; raw SQL escape hatch for hot paths |
| Database | PostgreSQL 16 | MySQL, MongoDB | Relational integrity for money/inventory, JSONB for flexible attrs, mature ops |
| Cache/queue | Redis (BullMQ) | RabbitMQ, memcached | Cache + queues in one, battle-tested, managed options cheap at MVP |
| Search | Postgres FTS+pg_trgm (MVP) → Typesense | Elasticsearch, Meilisearch | Cost/ops discipline at MVP; Typesense is self-host-friendly, low-ops relevance |
| Object storage + CDN | Cloudflare R2 + CF CDN | AWS S3+CloudFront | R2 = S3 API, no egress fees, cheap; CDN WAF included |
| Payments (IN) | Razorpay behind abstraction | Stripe, Cashfree, PayU | UPI cards netbanking wallets EMI COD links in one API; abstraction keeps swap easy |
| Auth | JWT access + rotating refresh (httpOnly) | Passport sessions, Auth0/Lucia | Stateless APIs + mobile-app future; OTP via SMS abstraction |
| Email | Resend/SES via abstraction | SendGrid, Postmark | Cheap, deliverability; template abstraction |
| SMS/OTP | MSG91 / Twilio-like via abstraction | — | OTP + transactional alerts, India-friendly routes |
| Logistics | Shiprocket v1 (abstraction) | Delhivery, Bluedart, Xpressbees | Pan-India pincode serviceability + tracking; swappable |
| Image/video | Next Image + Sharp (server job) → Cloudflare Images opt-in | imgix | Cheap; WebP/AVIF + thumbnails; CDN delivery |
| Jobs/workers | BullMQ workers in same deploy (separate process) | Celery, sidekiq | TS-consistent; same codebase; separate worker process |
| Observability | pino (JSON) + Sentry; later Prometheus/Grafana | Datadog(expensive), OTEL | Cheap start, standard tooling later |
| Infra MVP | Docker Compose locally · Render/Railway (web+worker) · managed Postgres/Redis · R2 | VPS (Hetzner/DigitalOcean), ECS | Fast to launch, zero-ops managed; VPS viable cheaper alternative |
| Infra scale | Container registry + k8s (EKS/GKE) or Cloud Run as org grows | — | Only when needed |
| CI/CD | GitHub Actions | GitLab CI, Argo | Repo is on GitHub; simple, powerful |
| E2E | Playwright | Cypress | Cross-browser, mobile viewports, MS APIs |
| API docs | OpenAPI 3 (Swagger UI) | — | Generated from NestJS decorators |

## 2. Key trade-off explanations

1. **TypeScript end-to-end vs Python/Django.** Django admin is tempting, but NestJS enforces
   module boundaries + DI that map 1:1 to our future service extraction, and type-sharing with the
   web storefront removes a whole class of API contract bugs. Trade-off: more boilerplate.
2. **Splitting API from Next.js (not Next API routes).** Dedicated API serves web today and the
   future mobile apps tomorrow (same auth, same versioning). Trade-off: one extra deployable.
3. **Postgres-first search.** Avoids a second infra system at MVP; Typesense migration is a
   module-internal swap because search is behind an interface. Trade-off: advanced relevance
   quality deferred.
4. **Self-host/VPS option vs managed.** Managed (Render) costs more per GB but saves DevOps time;
   a 2×Hetzner VPS can run MVP for ~$20–30/mo. Cost doc covers both. Decision lands in Phase 1 budget.
5. **Prisma vs raw SQL.** Prisma for CRUD speed; pricing/inventory money-paths use explicit
   transactions with `SELECT FOR UPDATE` and parameterized raw SQL where needed.

## 3. Explicitly rejected (with reason)

- **MongoDB primary**: money integrity + relational inventory/reservation needs.
- **Electron/desktop admin**: web admin sufficient; app later.
- **Laravel brand**: not a fit for TS-only org and future mobile API symmetry.
- **Kubernetes at MVP**: ops burden not justified pre-scale.
- **GraphQL primary**: product pages benefit from request caching and simple REST; GraphQL would
  complicate caching/video/forms. We standardize on REST + OpenAPI.

## 4. Version pins (Phase 1)

Node 20+, TypeScript 5.x, Next 14, NestJS 10/11, Prisma 5/6, BullMQ 5, Tailwind 3.4 (+ v4 when
stable), pnpm 9. All pinned in lockfile; upgrades via dedicated PRs.