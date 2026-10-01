# RankPilot AI — Product Architecture

## 1. Positioning

**RankPilot AI — AI Growth Operating System for Search, AI Discovery and Social Media.**
Not an audit tool: a closed loop of *understand → prioritize → generate → implement → measure → learn*.

Guarantee policy (hard product rule): never promise rankings, traffic, AI citations, views or virality. The product optimizes measurable factors and reports observed data only.

## 2. The growth loop (product spine)

```
WEBSITE → CRAWL → UNDERSTAND → AUDIT → OPPORTUNITIES → PRIORITIZE
   → GENERATE (SEO/AEO/GEO content, schema, links, social)
   → APPROVE → IMPLEMENT → PUBLISH → MEASURE → LEARN → IMPROVE → REPEAT
```

Every module must plug into at least one stage of this loop. Modules that only "display a metric" are rejected unless they answer: WHAT / WHY / PRIORITY / ACTION / RESULT.

## 3. Module map (36 modules → 6 layers)

| Layer | Modules | Phase |
|---|---|---|
| **Ingestion** | 1 Website Crawler · 26 GSC · 27 GA · 28 Bing · 39 Social analytics | MVP · V2 |
| **Analysis** | 2 Technical SEO · 3 On-Page · 4 Keyword Intelligence · 5 Search Intent · 6 Content Intelligence · 9 Topic Authority · 10 Content Gap · 11 Competitor Intel · 12 Internal Linking · 16 AI Search Visibility | MVP (2,3,9) · V2 (rest) |
| **Optimization** | 7 AEO Engine · 8 GEO Engine · 13 Schema Generator · 15 Content Optimizer | MVP (7,8,13,15 basic) |
| **Generation** | 14 AI Content Studio · 17 Social Growth · 18 Viral Ideas · 19 Social SEO · 20 Repurposing · 21 Calendar · 24 Hooks · 25 Retention · 26 Video scripts (short-form) | V1 |
| **Orchestration** | 23 Growth Copilot · 24 Action Center · 25 Auto-Fix · 36 AI Growth Agent · 29 A/B testing · 30 Experiment lab · 34 Content DNA | V1→V4 |
| **Business** | 29 Reporting · 30 Agency · 31 White label · 32 Billing · 33 Product analytics · 34 AI cost · 35 Security | MVP (billing/usage shell, security) · V2-V3 |

(Numbers follow the master prompt's module list; overlapping numbers are noted where the prompt re-used them.)

## 4. Tenancy & modes

- **Organization (`organizations`) = tenant.** Everything is scoped by `tenant_id`.
- One user may belong to many orgs; a membership row carries the role.
- **INDIVIDUAL MODE**: single org, one or a few websites, simple nav.
- **AGENCY MODE**: org flagged `mode='agency'`, multiple client websites (each client = `client` record or website-level ACL), team members with roles, white-label report branding fields on the org.

### Roles (RBAC)

| Role | Can |
|---|---|
| owner | everything incl. billing, members, deletion |
| admin | everything except billing/deletion |
| editor | read+write content, issues, social; no members/billing |
| analyst | read-only across data; no generation |
| client | read-only view of *one* website + its reports (agency) |

## 5. MVP scope (Phase 1 scope marked ★)

★ auth · ★ website onboarding + verification · ★ crawler · ★ technical SEO · ★ on-page SEO · ★ Growth Score · ★ issues → actions · keyword/topic discovery (on-page derived) · AEO question discovery · GEO recommendations · AI content optimizer · schema generator · internal linking · dashboard · basic reports · social idea + hook + reel/script generators · content calendar · usage limits.

V2: GSC/GA/Bing, competitors, content gap, advanced keywords, social analytics, Content DNA, experiments, advanced reports.
V3: AI visibility monitoring, CMS auto-fix, agency mode, white-label, publishing integrations.
V4: autonomous growth agent, i18n/international SEO, revenue attribution, enterprise.

## 6. Information architecture of the app

Three shells:

1. **Marketing shell** (public): landing, `/free-seo-audit`, pricing, product, blog/clusters.
2. **Auth shell**: register, login, verify, reset, onboarding wizard.
3. **App shell** (authenticated): left nav grouped by loop stage — Overview · Website (crawl, pages, issues) · Opportunities (keywords, questions, topics, gaps) · Create (studio, optimizer, schema, links) · Social (ideas, hooks, scripts, calendar) · Actions · Reports · Settings (billing, members, usage).

Global UX rule: every list page shows an empty state that explains *what will appear here and why it matters*, plus one primary CTA. Every issue card answers WHAT / WHY / PRIORITY / ACTION / RESULT.

## 7. Score architecture

**RankPilot Growth Score** = weighted average of available component scores (missing components are excluded and labelled "not yet measured", never guessed):

| Component | Weight | Source |
|---|---|---|
| Technical SEO | 0.20 | technical checklist |
| On-Page SEO | 0.20 | per-page on-page checklist |
| Content | 0.15 | depth/structure/coverage checks |
| AEO | 0.15 | question coverage + answer-block checks |
| GEO | 0.10 | entity/structured-data/clarity checks |
| Performance | 0.10 | response time, payload, image weight |
| Authority | 0.10 | internal linking, external references (V2: backlinks) |
| Social Growth | (separate track) | V2, needs connected accounts |

Component score = `round(100 × passed weight / applicable weight)` over documented checks. Every score response carries `methodology` (checks, weights, pass/fail) so the UI can always explain itself. AI Visibility is displayed separately until it has observable data.

## 8. Differentiator

`SEARCH + AI SEARCH + CONTENT + SOCIAL + ANALYTICS + AI OPTIMIZATION` in one loop — plus content repurposing (one article → LinkedIn/Facebook/X/Instagram/Reels/Shorts/newsletter) as the wedge feature.
