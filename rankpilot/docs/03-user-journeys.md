# RankPilot AI — User Journeys & UX States

Each journey lists steps, the screen, system behaviour, and the required UI states (loading / empty / success / failure).

## J1 — Activation: first audit (primary funnel)

| # | Step | Screen | System |
|---|---|---|---|
| 1 | Land | `/` hero "Turn Your Website Into an AI-Ready Growth Engine" | CTA → `/register` or `/free-seo-audit` |
| 2 | Sign up | `/register` (email, name, password) | creates user + org + membership, sets session cookie, `/onboarding` |
| 3 | Enter URL | `/onboarding` step 1 | zod validation, protocol normalization, SSRF blocklist (private IPs), duplicate check |
| 4 | Business profile | step 2: name, industry, country, audience, products, primary keywords, target market | saved on `websites` |
| 5 | Optional connections | step 3 (skip-allowed): competitors, GSC, GA, Bing, socials | MVP: recorded as `pending` integrations |
| 6 | Verification | step 4 | meta-tag token issued; site proceeds either way (verification improves crawl politeness, not access) |
| 7 | Crawl + analysis | progress screen | job runner: pages discovered / analyzed / issues / keywords / questions / opportunities counters stream via polling |
| 8 | Initial Growth Report | `/app/websites/[id]/report` | score + top 5 issues + top 5 opportunities + 3 quick wins |
| 9 | Dashboard | `/app` | growth score, latest crawl, open actions, next best action |

States: URL invalid → inline error; crawl queued → spinner + "we'll notify you"; crawl failed → failure card with retry + support link; no issues found → celebratory empty state ("here's what we checked").

## J2 — Fix loop (core retention)

1. Dashboard shows problem: *"18 pages are missing meta descriptions"* → WHY: crawlable pages without a snippet target → PRIORITY: high → ACTION: button.
2. Click → issue detail: affected pages, evidence (URL + observed value), recommendation, "Generate with AI" (approval required).
3. AI draft shown as BEFORE/AFTER diff → user approves → becomes an Action (status `approved`) → export (CSV/JSON) or Auto-Fix (V3).
4. User re-crawls (or waits for scheduled audit) → issue status `resolved` when the check passes → RESULT shown: issue closed, score delta recorded.

Failure states: AI unavailable → issue remains fully actionable manually; generation cost over quota → clear upgrade prompt with usage numbers.

## J3 — Discover loop (opportunities)

Questions (`/app/websites/[id]/questions`) and Keywords (`…/keywords`) derived from real crawled content, each with intent + recommended URL + priority. Empty state: "We need one crawl before we can discover opportunities." Gap analysis (V2) compares competitors.

## J4 — Create loop (content)

1. `/app/studio`: topic, keyword, intent, audience, country, tone, type → generate outline → review → generate article.
2. Output: SEO title, meta, H1, outline, article, FAQs, internal links, schema, CTA, social variants — each block copy/approve independently.
3. Save to `content` (status draft) → Action Center tracks implementation → measures after publish (V2 via GSC).

## J5 — Social loop

Campaign wizard (15-step high-reach workflow, MVP = steps 1-11): platform → audience → objective → 20 ideas → select → hooks → script (15/30/45/60/90s with retention beats) → visual direction → captions → hashtags → A/B variants → export/publish → metrics (V2) → learn → iterate. Ethical guardrail: no fake engagement, no deceptive hooks; every generated hook must be truthful to the script.

## J6 — Agency loop (V3)

Owner creates client workspaces, invites editors/analysts with roles, assigns websites, configures white-label branding, schedules report delivery per client. Client-role users log into a read-only view of their own website only (tenant + scope filters enforced server-side).

## J7 — Copilot query (V2)

User asks "What should I fix first?" → copilot answers with three visually separated blocks: **Observed data** (from DB), **AI interpretation**, **Recommendation**. If data is missing it says so rather than speculating.

## Global UI state matrix (applies to every screen)

| State | Requirement |
|---|---|
| Loading | Skeleton matching final layout; never a bare spinner for lists |
| Empty | Explains what will appear + why it matters + primary CTA |
| Success | Confirmation + next best action |
| Error | What failed, why, retry button, support path; no stack traces |
| Unauthorized | Redirect to `/login?next=…`; 401/403 from API rendered as friendly copy |
| Quota | Shows used/limit with upgrade path (`usage` endpoint) |
