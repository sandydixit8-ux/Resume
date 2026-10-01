# RankPilot AI — MVP Roadmap & Phase Plan

Rule: build incrementally; after each phase run `typecheck`, `lint`, `test`, `build`; validate data, check security, document APIs, update this roadmap.

## Phase status legend: ☐ planned · ◐ in progress · ☑ done

## Phase 1 — Foundation + Audit core (THIS PHASE) ☑

1. Project scaffold, tooling, env ✅ scaffold
2. Database schema + migrations + `scripts/init-db.ts` ✅
3. Auth: register/login/logout/session/RBAC/tenant isolation + rate limits ✅
4. Website onboarding: URL validation, profile, verification token ✅ (4-step wizard incl. crawl kickoff)
5. Job runner (jobs table + worker, retry/timeout/status) ✅
6. Crawler: robots/sitemap/frontier/fetch/parse/persist + progress counters ✅
7. Technical SEO engine (checks 8.1) + On-page engine (checks 9.1) ✅ (20+ checks, T/O/A/G/P codes)
8. Growth Score engine (weighted, explainable methodology) ✅
9. Keyword + AEO question discovery from real crawl text; GEO recommendations (rules) ✅ (GEO rule checks G001–G003; generated recommendation copy lands in Phase 2 with the AI layer)
10. Action Center (issue → action) + issue status transitions ✅ (auto-actions for critical/high)
11. Dashboard, website overview, pages, issues, report screens (5 states each) ✅ (+ page detail, issues detail, keywords, questions)
12. Free audit endpoint (rate-limited) + landing page ✅ (`POST /api/audit/free`, 5/day/IP, single-page limited audit → `/free-seo-audit`)
13. Usage limits (websites, pages crawled, AI generations) ✅ (plan limits enforced on website create; crawl pages capped by plan)
14. Tests: unit (checks/scoring/auth/url utils), API-level, cross-tenant isolation ✅ 42 tests (score, checks, auth, url, free-audit validation, DB tenant isolation)

**Acceptance**: sign up → add URL → crawl a real site → see score + issues + questions + actions, all tenant-isolated, `npm test` green. ✅ verified end-to-end against example.com (crawl → score 29 → 11 issues → 1 action → report) + cross-tenant reads return `not_found`.

## Phase 2 — Content & generation ☑

- AI Content Studio: generate → draft → optimize (BEFORE/AFTER diff) → approve/reject, version history ✅ (`/app/studio`, `/api/content*`)
- Schema generator: FAQPage/Article/HowTo/Organization/BreadcrumbList/Product JSON-LD preview + download ✅ (`/api/schema`, website tab)
- Internal linking recommendations (deterministic, from crawled anchors/text) ✅ (`/api/links`, tab)
- AEO answer drafts (approval-gated) ✅ (`/api/questions/[id]/answer`)
- GEO recommendation generation ✅ (`/api/geo`, rules + AI task)
- Social generators: ideas → hooks → scripts → captions; campaigns + calendar ✅ (`/api/social/*`, `/app/social`)
- Repurposing engine: article → channel assets (≤4 per request, drafts only) ✅ (`/api/content/repurpose` + Studio card)
- AI cost metering UI ✅ (`/app/settings/usage`, `ai_usage` per call with model/promptVersion/source)
- Reports: JSON/CSV/self-made PDF with methodology note + plan quota ✅ (`/api/reports`)
- AI foundation layer: router/provider(zero-key fallback)/prompts v1/guardrails/context pack/quota metering/12 tasks ✅ (`src/lib/ai/*`, 49 tests green)

**Acceptance** ✅: with no `OPENAI_API_KEY`, every generation returns deterministic `source:"rules"` output plus a `degraded` note; quota exhaustion → HTTP 402; approved content is the only thing that can be repurposed/published.

## Phase 3 — Integrations & intelligence ☑

- Analytics import (GSC/GA4/Bing): reports `unavailable` rows when no integration; observed CTR/rank fields surfaced ✅ (`/api/analytics/import`)
- Search Console sync: service-account pull into `keywords` (source `gsc`), 27-day window behind a 3-day processing deadline, no-access surfaced as a fixable reason, disconnect revokes the imported rows ✅ (`/api/analytics/import` {source:gsc}; needs a service account to activate)
- Competitor intelligence: add competitor → single-page audit → score/overlap → gap detection ✅ (`/api/competitors`, `/api/gaps`, tab)
- Keyword intelligence: provider-key check; without key every volume stays "Data unavailable" ✅ (`/api/keywords/enrich`)
- Content DNA: structural fingerprint from crawled pages only (nulls when unobserved) ✅ (`/api/content/dna`, Labs tab)
- Topics / topic authority map ✅ (`/app/websites/[id]/topics`)
- Scheduled audits: daily/weekly/monthly → `crawl_schedules` + worker tick enqueues crawls ✅ (`/api/schedules`, `src/lib/crawler/schedules.ts`, Labs tab)

**Acceptance** ✅: no integration is ever faked — every connector endpoint returns explicit `status:"unavailable"` + note when credentials are absent.

## Phase 4 — Growth surfaces ☑

- Growth Copilot: threads + messages split into observed / interpretation / recommendation ✅ (`/api/copilot`, `/app/copilot`)
- A/B experiment lab: create variants, run/pause/conclude, manual result entry (never auto-guessed) ✅ (`/api/experiments`, Labs tab)
- AI search visibility: queries recorded immediately; `brand_mentioned = null` ⇒ "unmeasured", never a fabricated miss ✅ (`/api/visibility`, Labs tab)
- Repurposing UI (approval-gated) ✅ (Studio detail card)
- Reports white-labeled via saved branding ✅ (`/api/settings/branding`)
- Deferred (needs real provider OAuth): 15-step campaign wizard (a focused New Campaign flow ships instead), article → 30+ assets in one shot (bounded ≤4/request by design)

## Phase 5 — Agency & automation ☑

- Agency mode: clients, website↔client assignment, client list w/ counts ✅ (`/api/clients`, `/app/settings/clients`)
- White-label branding (logo/colors/domain fields) ✅ (`/app/settings/branding`)
- Billing: plan change with limit enforcement + downgrade guard ✅ (`/api/billing`, `/app/settings/billing`)
- Stripe checkout + webhook: upgrades flow through a real Checkout Session; webhook verifies signature, applies plan lifecycle, audits every change ✅ (`/api/billing/checkout`, `/api/billing/webhook`; needs live keys to activate)
- Members: invite-less role change + removal (owner protected) ✅ (`/api/members`)
- Publishing/CMS integrations: connection state toggles, credentials env-only ✅ (`/api/integrations`)
- CMS auto-fix: propose → backup_ref → apply → verify → discard; without connected CMS it stops at `blocked` and claims nothing ✅ (`/api/cms-fixes`, Labs tab)
- WordPress apply: real REST writes with the pre-change post stored as a restorable backup, verify re-reads the live post and reports drift, restore rolls back, a live fix cannot be discarded ✅ (`/api/cms-fixes`; needs a WordPress application password to activate)
- Deferred (needs real provider API or credentials): actual WordPress/Shopify/Webflow/Wix writes, live Google/Stripe/Search Console activation

## Phase 6 — Autonomous ☑

- AI Growth Agent: "today's priorities" from crawl context, run persisted in `agent_runs`, top priority promoted into Action Center ✅ (`/api/agent`, `/app/agent`)
- Autonomous opportunity discovery (critical/high issues → opportunities list) ✅
- Multi-language readiness: observed `lang` distribution across crawled pages ✅ (Agent page)
- Revenue attribution: manual events per source/website, totals (no auto-attribution claims) ✅ (`/api/revenue`, Agent page)
- Enterprise features: tenant isolation + RBAC + audit log on every mutation (carried through all phases)
- Deferred: automated multi-language detection beyond `<html lang>`, revenue auto-attribution from analytics

## Cross-phase quality gates (every phase)

- `npm run typecheck` · `npm run lint` · `npm test` · `npm run build` all green
- Tenant-isolation test extended for new tables
- Every new endpoint: zod validation + authz + rate limit + audit entry
- Every new screen: loading/empty/success/failure/quota states
- Docs updated: API spec, ERD, roadmap
- No fabricated metrics anywhere; unavailable → "Data unavailable"
- No guarantees language in copy (rankings/traffic/citations/views)

## Definition of done (product-level)

The loop works end-to-end: crawl → audit → prioritize → generate → approve → implement → measure → learn. A new user completes activation (first audit) in < 5 minutes and always knows the next best action.
