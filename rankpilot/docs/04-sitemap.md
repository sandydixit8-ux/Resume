# RankPilot AI — Sitemap / Route Tree

All routes are inside the `rankpilot/` app. `★` = built in MVP Phase 1.

## 1. Marketing (public)

| Route | Purpose | Status |
|---|---|---|
| `/` ★ | Landing: hero, problem, solution, SEO/AEO/GEO/content/social/competitor sections, how it works, use cases, pricing, FAQ, CTA | built |
| `/free-seo-audit` ★ | URL input → limited audit (score, top issues, top opportunities) → "Unlock Full Growth Report" | built |
| `/pricing` | Plans FREE / PRO / GROWTH / AGENCY (prices and limits read from `src/lib/plans.ts`, never hard-coded in UI) | built |
| `/product/{seo,aeo,geo,content,social}` | Pillar pages (V1 content clusters) | deferred — no inbound links; safe to add later |
| `/blog/[slug]` | Content cluster articles (V1) | deferred — no inbound links; safe to add later |
| `/legal/{privacy,terms}` | Legal, written to match actual data handling (env-var credentials, opt-in AI provider, no payment processor) | built |
| `/robots.txt`, `/sitemap.xml` | Own crawlability | built |

Nothing in the app links to the deferred `/product/*` or `/blog/*` routes, so they are not dead links today.

## 2. Auth

| Route | Purpose |
|---|---|
| `/register` ★ | email + name + password → user + org + session |
| `/login` ★ | email + password → session (`?next=` redirect) |
| `/logout` ★ | revoke session, clear cookie |
| `/forgot-password`, `/reset-password` | V1 (needs email provider) |
| `/verify-email` | V1 |

## 3. Onboarding

| Route | Purpose |
|---|---|
| `/onboarding` ★ | 4 steps: URL → business profile → connections + verification → crawl kickoff & live progress (step 4 shows pages discovered/analyzed, issues, keywords, questions, opportunities) |
| `/onboarding/progress` | superseded by step 4 of `/onboarding` ★ |

## 4. App (authenticated, tenant-scoped)

| Route | Purpose |
|---|---|
| `/app` ★ | Overview: Growth Score, components, latest crawl, top issues, next best action, usage |
| `/app/websites` ★ | Website list + add |
| `/app/websites/[id]` ★ | Website overview: score, crawl status, issue counts |
| `/app/websites/[id]/report` ★ | Initial/full growth report |
| `/app/websites/[id]/crawl` | Crawl controls + history |
| `/app/websites/[id]/pages` ★ | Crawled pages table (filter/sort) |
| `/app/websites/[id]/pages/[pageId]` ★ | Page detail: on-page analysis + issues |
| `/app/websites/[id]/issues` ★ | Issue list (severity/category/status filters) |
| `/app/websites/[id]/issues/[issueId]` ★ | Issue detail: evidence, why, recommendation, AI fix, → action |
| `/app/websites/[id]/keywords` ★ | Keyword intelligence (derived from crawl; volume shows "Data unavailable" if unknown) |
| `/app/websites/[id]/questions` ★ | AEO questions + recommended answers/URLs |
| `/app/websites/[id]/topics` | Topic authority map (V1) |
| `/app/websites/[id]/links` | Internal linking recommendations |
| `/app/websites/[id]/schema` | Schema generator/manager |
| `/app/websites/[id]/competitors` | Competitor intelligence (V2) |
| `/app/studio` | AI Content Studio (create) |
| `/app/studio/[contentId]` | Editor + optimizer (BEFORE/AFTER) |
| `/app/social` | Social Growth hub |
| `/app/social/campaigns/new` | High-reach campaign wizard (15 steps) |
| `/app/social/campaigns/[id]` | Ideas → hooks → scripts → captions → A/B |
| `/app/social/calendar` | Content calendar 7/14/30/90-day |
| `/app/actions` ★ | Action Center (issue → task: owner, status, due date) |
| `/app/reports` | Report list + generate (PDF/CSV/JSON) |
| `/app/copilot` | Growth Copilot chat (V2) |
| `/app/settings/{profile,billing,members,usage,integrations,branding}` | Org settings |

## 5. API (`/api`, JSON envelope `{ok,data}|{ok,error:{code,message}}`)

### Auth & org ★
```
POST   /api/auth/register        {name,email,password}
POST   /api/auth/login           {email,password}
POST   /api/auth/logout
GET    /api/auth/me              → user, org, role, plan, usage
PATCH  /api/auth/me              {name?}
```

### Websites & crawl ★
```
GET    /api/websites
POST   /api/websites             {url, name?, profile…}
GET    /api/websites/:id
PATCH  /api/websites/:id
DELETE /api/websites/:id                       (soft)
POST   /api/websites/:id/verify     → token/meta tag
POST   /api/websites/:id/crawl      → {runId}
GET    /api/websites/:id/score      → score + methodology
```

### Crawl results ★
```
GET    /api/crawl-runs?websiteId=   → list
GET    /api/crawl-runs/:id          → status + progress counters
GET    /api/pages?websiteId=&q=&severity=  (paginated)
GET    /api/pages/:id
GET    /api/issues?websiteId=&severity=&category=&status=
GET    /api/issues/:id
PATCH  /api/issues/:id              {status}
```

### Opportunities ★
```
GET    /api/keywords?websiteId=
GET    /api/questions?websiteId=
POST   /api/questions/:id/answer    (AI draft, approval-gated)
```

### Content / schema / links / social (V1, spec'd now)
```
POST   /api/content/generate        {topic,keyword,intent,audience,country,tone,type}
POST   /api/content/optimize        {contentId | text}
GET    /api/content
POST   /api/schema/generate         {pageId | url,type}
GET    /api/links?websiteId=
POST   /api/social/ideas            {campaignId | brief}
POST   /api/social/hooks            {ideaId}
POST   /api/social/scripts          {ideaId,duration}
GET    /api/social/calendar
POST   /api/reports                 {websiteId,type,format}
```

### Platform
```
GET    /api/usage                   → quotas used/limit
GET    /api/jobs/:id                → job status
POST   /api/audit/free              {url,email?} → limited audit snapshot
GET    /api/health
```

### Conventions
- Auth: session cookie; all `/api/*` except `auth/*`, `health`, `audit/free` require it.
- Validation: zod; failure → `400 validation` with `details`.
- Rate limits: per-IP + per-tenant on expensive endpoints (crawl, AI, reports) → `429 rate_limited`.
- Pagination: `?limit=` (max 100) + `?cursor=`/`offset`, response `{items, total?, nextCursor?}`.
- Errors: `auth_required | forbidden | not_found | validation | conflict | rate_limited | quota_exceeded | server_error`.
