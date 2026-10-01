# RankPilot AI — API Specification

Base: `/api`. All responses use the envelope:

```jsonc
// success
{ "ok": true, "data": { ... } }
// failure
{ "ok": false, "error": { "code": "validation", "message": "Validation failed", "details": [ ... ] } }
```

Error codes: `auth_required`(401) · `forbidden`(403) · `not_found`(404) · `validation`(400) · `conflict`(409) · `rate_limited`(429) · `quota_exceeded`(402) · `server_error`(500).

Cross-cutting rules (enforced on every route):

- session-cookie auth; `getSession()` first
- RBAC check via `can(session.role, permission)`. This matrix in `src/lib/auth/rbac.ts` is the **only** authorization source: routes must not hardcode role comparisons (enforced by `src/lib/auth/rbac.test.ts`). The only intentional exceptions are the unauthenticated routes listed above and `PATCH /auth/me`, which edits the caller's own profile row.
- zod validation on every request **body** (enforced by `src/lib/api-validation.test.ts`, which also rejects `as { ... }` casts of `req.json()` — a compile-time claim that let a wrong-typed `websiteId` reach the driver and return 500 instead of 400). **Query parameters are not zod-parsed**: `websiteId`-style values are opaque ids that must pass a tenant-scoped lookup, and enum-ish filters such as `status`/`from`/`to` are bound as `?` parameters. They are safe because they are always bound, never interpolated. The only interpolations into SQL text are internal clause lists (`whereSql`, `where.join(" AND ")`) and `column`, which is resolved through a `COLUMN_MAP` allowlist; the test allowlists exactly those.
- SQL values are always bound. The one dynamic identifier, the website PATCH column, comes from `COLUMN_MAP` with an unmapped-key `continue` guard, so a caller-supplied key can never reach the SQL string.
- tenant scoping on every query (`tenant_id` from the session, never from the body)
- rate limits on expensive operations (in-memory sliding window, per-process)
- audit-log entry on mutations that change workspace or website state

### Role matrix

| Permission | client | analyst | editor | admin | owner |
|---|---|---|---|---|---|
| `website:read`, `issues:read`, `actions:read`, `content:read`, `social:read`, `reports:read`, `settings:read` | yes | yes | yes | yes | yes |
| `website:write`, `crawl:run`, `issues:write`, `actions:write`, `content:write`, `social:write` | – | – | yes | yes | yes |
| `reports:run`, `members:write`, `website:delete` | – | – | – | yes | yes |
| `billing:write` | – | – | – | – | yes |

`GET`-only routes rely on the session plus tenant scoping and do not call `can()`. `POST /agent` and `POST /copilot` pass their permission to `aiCall(...)` instead of calling `can()` directly.
- AI routes go through `aiCall()`: permission → 30 req/min/tenant rate limit → plan quota check (402) → provider call or deterministic rules fallback → guardrails → `ai_usage` write

Anything not observed is returned as `null` plus a `note`; the UI renders "Data unavailable". No endpoint invents metrics.

## Audit trail

`audit()` (`src/lib/audit.ts`) writes to `audit_logs` and **swallows its own errors on purpose**, so a broken audit write can never fail a user request — and nothing at runtime would reveal it. Two mechanisms keep it honest:

- `src/lib/audit-coverage.test.ts` reads the route files and fails if any mutating route stops calling `audit({ … })`. It also pins the exact set of exempt routes, so widening the exemption requires editing the test deliberately.
- Route discovery uses `fs`/`path.join`, never shell globbing. (PowerShell's `Select-String -Path` treats `[id]` as a wildcard character class and silently matches nothing, which previously hid every dynamic route from a coverage audit.)

Action names are `entity.verb` or `entity.<status>`. This list is generated from the code (`action:` values in `src/app/api/**/route.ts`) and is enforced by `src/lib/audit-coverage.test.ts`:

| Route | Action(s) |
|---|---|
| `/auth/register`, `/auth/login`, `/auth/logout` | `auth.register`, `auth.login`, `auth.logout` |
| `/auth/me` PATCH | `user.profile_update` |
| `/websites` POST | `website.create` |
| `/websites/:id` PATCH / DELETE | `website.update` (meta lists changed fields), `website.delete` (meta `softDelete: true`) |
| `/websites/:id/verify` POST | `website.verify` — logged for all three outcomes, including `verified:false` with a `reason` |
| `/websites/:id/crawl` POST / DELETE | `crawl.start`, `crawl.cancel` |
| `/schedules` PUT | `crawl.schedule_set` |
| `/issues/:id` PATCH | `issue.<status>` (meta keeps `previousStatus`) |
| `/actions` POST · `/actions/:id` PATCH | `action.create`, `action.<status>` |
| `/content` POST | `content.generate` |
| `/content/:id` PATCH / POST | `content.<status>`, `content.optimize` |
| `/content/repurpose` POST | `content.repurpose` |
| `/questions/:id/answer` POST | `question.answer` — meta records `source: "manual"` vs the AI source |
| `/schema` POST | `schema.generate` |
| `/competitors` POST | `competitor.audit`, `competitor.audit_failed` |
| `/gaps` PATCH | `content_gap.<status>` |
| `/social/campaigns` POST / PATCH | `social_campaign.create`, `social_idea.select` |
| `/social/calendar` POST / PATCH | `social_calendar.create`, `social_calendar.<status>` (incl. `published`) |
| `/experiments` POST / PATCH | `experiment.create`, `experiment.<status>` |
| `/visibility` POST | `visibility.track` |
| `/reports` POST | `report.generate` |
| `/agent` POST | `agent.run` |
| `/revenue` POST / DELETE | `revenue.create`, `revenue.delete` |
| `/cms-fixes` POST / PATCH | `cms_fix.propose`, `cms_fix.<action>` |
| `/clients` POST / PATCH | `agency.client_create`, `agency.website_assign` |
| `/members` PATCH / DELETE | `members.role_change`, `members.remove` |
| `/billing` PATCH | `billing.plan_change` |
| `/integrations` POST | `integrations.<status>` |
| `/settings/branding` PUT | `settings.branding` |

**Exemptions (7 routes, each deliberate):**

| Route | Why no `audit_logs` row |
|---|---|
| `/geo` | Pure computation, writes nothing |
| `/keywords/enrich` | Read-through; without `KEYDATA_API_KEY` it returns `status:"unavailable"` and stores no rows |
| `/analytics/import` | Read-through; without a connected integration it returns `status:"unavailable"` and zero rows |
| `/copilot` | AI generation, already metered per call in `ai_usage` (task, model, prompt version, tokens, cost) |
| `/social/ideas`, `/social/scripts` | Same — AI generations metered in `ai_usage` |
| `/audit/free` | Unauthenticated; recorded in its own `free_audits` table (url, email, ip, score, snapshot) |

## Auth & identity

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/auth/register` | `{name,email,password,orgName?}` | `{user,orgId,role}` + sets cookie; 5/min/IP |
| POST | `/auth/login` | `{email,password}` | same; 10/15min per IP, 5/15min per email |
| POST | `/auth/logout` | – | revokes session row, clears cookie |
| GET | `/auth/me` | – | `{user,org,role,plan,usage,limits}` |
| PATCH | `/auth/me` | `{name?}` | updated user |

## Websites

| Method | Path | Body/Query | Notes |
|---|---|---|---|
| GET | `/websites` | – | tenant sites + latest score/crawl summary |
| POST | `/websites` | `{url,name?,industry?,country?,audience?,products?,primaryKeywords?,targetMarket?,competitors?[]}` | normalizes URL, blocks private/localhost hosts (SSRF guard), 409 on duplicate, plan limit; 20/min/tenant |
| GET | `/websites/:id` | – | detail incl. latest score |
| PATCH | `/websites/:id` | partial profile | |
| DELETE | `/websites/:id` | – | soft delete |
| POST | `/websites/:id/verify` | – | `{token, metaTag, instructions}` |
| POST | `/websites/:id/crawl` | `{maxPages?}` | plan quota check → `crawl_runs` + `jobs` → `{runId, maxPages, notice?}`; 10/hour/tenant |

## Crawl & results

| Method | Path | Query | Returns |
|---|---|---|---|
| GET | `/crawl-runs/:id` | – | `status`, counters (`pagesDiscovered, pagesAnalyzed, issuesFound, keywordsFound, questionsFound`), `error` |
| GET | `/pages` | `websiteId, q?, indexable?, limit, offset` | paginated pages |
| GET | `/issues` | `websiteId, severity?, category?, status?, limit, offset` | paginated + `counts` by severity |
| GET | `/issues/:id` | – | issue + page evidence |
| PATCH | `/issues/:id` | `{status}` | status transitions only |
| GET | `/keywords` | `websiteId, q?, limit, offset` | `volume/difficulty/rank/ctr = null` when unknown |
| GET | `/questions` | `websiteId` | AEO questions w/ intent, priority, recommended url/answer |
| POST | `/questions/:id/answer` | – | AI answer draft (metered) → `{answer, schemaSuggestion}` |
| GET | `/links` | `websiteId` | deterministic internal link suggestions |
| POST | `/schema` | `{websiteId,pageId,type}` | rules-built JSON-LD for FAQPage/Article/HowTo/Organization/BreadcrumbList/Product |
| POST | `/geo` | `{websiteId}` | GEO recommendations with rule codes |
| GET | `/websites/:id/score` | – | `{overall, components:{name:{score,weight,passed,applicable,checks:[]}}, methodology, runId, measuredAt}` |

### Plan limits applied during a crawl

A crawl never silently exceeds what the tenant paid for, and never quietly does less:

- **Pages** — `maxPages` is resolved to `min(requested, plan.pagesPerCrawl, CRAWLER_MAX_PAGES)`. `POST /websites/:id/crawl` returns the resolved `maxPages`, plus a `notice` when the request was reduced. `GET /crawl-runs/:id` reflects what was actually analyzed.
- **Tracked keywords** — a run persists at most `plan.keywords` keywords for the tenant (existing rows count against the allowance). When the allowance runs out mid-run the run records `stats.keywordCapHit` and `keywords_found` reflects only what was stored. Already-tracked terms are still refreshed after the cap is reached; only new ones are refused.

## Content Studio (Phase 2)

| Method | Path | Body/Query | Notes |
|---|---|---|---|
| GET | `/content` | `websiteId` | list non-deleted content |
| POST | `/content` | `{websiteId, brief:{title,goal,keyword,intent,audience,tone,type,cta}}` | generates draft + v1 version; stays `draft` until approved |
| GET | `/content/:id` | – | content + version history |
| PATCH | `/content/:id` | `{status?,title?,body?,note?}` | edits create a new version; `approved` stamps `approved_at`; audited |
| POST | `/content/:id` | – | optimize → new draft version with BEFORE/AFTER changes |
| GET | `/content/:id/versions` | – | full version list |
| POST | `/content/repurpose` | `{contentId, formats[]}` (1–4 of linkedin/x/instagram/newsletter/script/blog) | approval-gated; creates new **drafts** linked by `source_content_id` |
| GET | `/content/dna` | `websiteId` | Content DNA: page counts, avg word/title/meta length, FAQ & schema coverage, image-alt coverage, heading depth. `null` = not observed |

## Social (Phase 2)

| Method | Path | Body | Notes |
|---|---|---|---|
| GET/POST | `/social/campaigns` | `{websiteId, name, audience, goal, platforms[]}` / PATCH `{id, ideaId}` | campaigns; social quota per plan |
| GET/POST | `/social/ideas` | `{campaignId}` | ideas (hooks/angles) per campaign |
| GET/POST | `/social/scripts` | `{ideaId, hookMode?}` | hooks + short-form script |
| GET/POST/PATCH | `/social/calendar` | `{campaignId, contentId, channel, scheduledFor, status?}` | status is one of draft/review/approved/scheduled/published; publishing needs an approved post |

## Reports (Phase 2)

| Method | Path | Body/Query | Notes |
|---|---|---|---|
| GET | `/reports` | `websiteId?, type?` | report history + usage counters |
| POST | `/reports` | `{websiteId, type: growth\|issues\|content\|social\|usage, format: json\|csv\|pdf}` | synchronous in this build; writes `data/reports/<tenant>/<id>.<fmt>`; report quota; 10/min/tenant; PDF is self-made, no external service |
| GET | `/reports/:id` | – | file download (tenant-scoped path check) |

## Competitors & gaps (Phase 3)

| Method | Path | Body/Query | Notes |
|---|---|---|---|
| GET/POST | `/competitors` | `{websiteId, url, name?}` | single-page audit via shared `auditUrl()`; records score + keyword overlap; 6/min/tenant; `competitors` plan limit |
| GET/PATCH | `/gaps` | `websiteId`, PATCH `{id, status}` | content gaps detected from competitor keywords |

## Intelligence & automation (Phase 3–4)

| Method | Path | Body/Query | Notes |
|---|---|---|---|
| GET/PUT | `/schedules` | `websiteId` / `{websiteId, frequency: daily\|weekly\|monthly\|null}` | writes `crawl_schedules` + `websites.crawl_schedule`; worker tick enqueues due crawls |
| POST/GET | `/keywords/enrich` | `{websiteId, limit}` / `?websiteId` | provider-key check; without `KEYDATA_API_KEY` returns `status:"unavailable"` and `null` volumes |
| POST/GET | `/analytics/import` | `{websiteId, source: gsc\|ga4\|bing}` | without a connected integration returns `status:"unavailable"` and zero rows; never estimates CTR. `source:gsc` with a connected integration + service account runs a real Search Analytics pull into `keywords` (`source:"gsc"`), windowed `[today-27, today-GSC_DEADLINE_DAYS]` |
| GET/POST | `/visibility` | `websiteId` / `{websiteId, query, engine}` | AI-search visibility. `brand_mentioned = null` ⇒ "unmeasured", never a fabricated miss |
| GET/POST/PATCH | `/experiments` | `{websiteId,name,hypothesis,metric,variants[]}` / PATCH `{id,status}` or `{variantId,resultValue}` | A/B lab. Result values are entered manually; empty means "Data unavailable" |
| GET/POST/PATCH | `/copilot` | `{question, websiteId?, title?}` | threads/messages; answers split into `observed` / `interpretation` / `recommendation` |
| POST/GET | `/agent` | `{websiteId}` | Phase 6 run: persists `agent_runs`, promotes the top priority into the Action Center; never publishes or fixes anything |

## Agency, billing, integrations (Phase 5)

| Method | Path | Body | Notes |
|---|---|---|---|
| GET/POST/PATCH | `/clients` | `{name,contact,notes}` / `{websiteId, clientId\|null}` | first client switches the org to `agency` mode |
| PATCH | `/billing` | `{plan}` | local plan change + downgrade guard; allowlist-only, never a payment substitute |
| PATCH/DELETE | `/members` | `{membershipId, role}` / `{membershipId}` | owner role is protected; audited |
| POST | `/integrations` | `{provider, status}` | connection state only; credentials live in env vars, never in the DB. Setting `search_console` to `disconnected` revokes the imported GSC keyword rows |
| GET/PUT | `/settings/branding` | `{logoUrl?, primaryColor?, accentColor?, agencyName?, supportEmail?, customDomain?}` | applied to report output |
| GET/POST/PATCH | `/cms-fixes` | `{websiteId, issueId?, provider, payload}` / `{id, action: apply\|verify\|restore\|discard}` | propose → backup → apply → verify → restore. The backup is the real pre-change post content; `verify` re-reads the live post and reports drift instead of claiming success; a live fix cannot be discarded, only restored. Without `WORDPRESS_*` credentials every fix stops at `blocked` and nothing is changed on your site |

## Revenue attribution (Phase 6)

| Method | Path | Body | Notes |
|---|---|---|---|
| GET/POST/DELETE | `/revenue` | `{source,label,amountUsd,occurredAt,websiteId?}` | manually recorded events; no auto-attribution claims |

## Actions (Action Center)

| Method | Path | Notes |
|---|---|---|
| GET/POST | `/actions` | `websiteId?, status?, owner?`; POST `{title, issueId?, priority, impact, effort, ownerUserId?, dueDate?}` |
| PATCH | `/actions/:id` | `{status, ownerUserId?, dueDate?}` |

## Platform

| Method | Path | Notes |
|---|---|---|
| GET | `/usage` | `{period, metrics:{metric:{used,limit}}}` + AI spend |
| POST | `/audit/free` | unauthenticated single-page audit, IP rate-limited 5/day, no tenant data persisted |
| GET | `/health` | `{ok, db, version}` |

## Job types (internal, `jobs` table)

`crawl.run` · `report.generate` · `content.publish` · `schedules.tick` — see `src/lib/jobs/queue.ts` and `src/lib/crawler/`.
