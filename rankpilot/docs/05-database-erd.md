# RankPilot AI — Database ERD (schema.sql is the source of truth)

Engine: SQLite (WAL, `foreign_keys=ON`). IDs: `prefix_uuid` text. All tenant tables carry `tenant_id` (FK → organizations) for isolation. Timestamps: ISO-8601 TEXT (`created_at`, `updated_at`). Soft delete via `deleted_at` where noted.

## Core identity & tenancy

```
users(id PK, email UNIQUE, name, password_hash, email_verified_at, created_at, updated_at, deleted_at)
organizations(id PK, name, slug UNIQUE, plan, mode[individual|agency], branding JSON,
              created_at, updated_at, deleted_at)
memberships(id PK, tenant_id→organizations, user_id→users, role[owner|admin|editor|analyst|client],
            created_at, UNIQUE(tenant_id,user_id))
sessions(id PK, tenant_id, user_id, token_hash, expires_at, revoked_at, ip, user_agent, created_at)
subscriptions(id PK, tenant_id, plan, status, provider, provider_ref, period_end, created_at, updated_at)
plans_usage(id PK, tenant_id, metric, period[YYYY-MM], used, UNIQUE(tenant_id,metric,period))
audit_logs(id PK, tenant_id, user_id, action, entity, entity_id, meta JSON, ip, created_at)
jobs(id PK, tenant_id, type, payload JSON, status[pending|running|done|failed|cancelled],
     attempts, max_attempts, run_at, started_at, finished_at, error, locked_by, created_at)
ai_usage(id PK, tenant_id, task, model, prompt_version, tokens_in, tokens_out, cost_usd,
         cached, duration_ms, status, created_at)
```

## Website & crawl

```
websites(id PK, tenant_id, name, url, normalized_url, verification_token, verified_at,
         industry, country, audience, products, primary_keywords, target_market,
         competitor_urls JSON, last_crawled_at, created_at, updated_at, deleted_at,
         UNIQUE(tenant_id, normalized_url))

crawl_runs(id PK, tenant_id, website_id→websites, status[queued|running|done|failed|cancelled],
           trigger[manual|scheduled|onboard], started_at, finished_at,
           pages_discovered, pages_analyzed, issues_found, keywords_found,
           questions_found, opportunities_found, bytes_downloaded, avg_response_ms,
           error, stats JSON, created_at)

crawl_urls(id PK, run_id→crawl_runs, url, url_key, depth, source[sitemap|robots|link],
           status[pending|fetching|done|skipped|error], http_status, attempts, error, fetched_at,
           UNIQUE(run_id, url_key))

pages(id PK, tenant_id, website_id→websites, run_id→crawl_runs, url, url_key,
      status_code, redirect_url, content_type, depth,
      title, title_len, meta_description, meta_desc_len, h1, headings JSON,
      canonical, robots_meta, is_indexable, word_count, lang,
      internal_link_count, external_link_count, image_count, images_missing_alt,
      html_bytes, ttfb_ms, has_structured_data, structured_types JSON,
      og_title, og_description, og_image, text_sample TEXT, fetched_at,
      UNIQUE(website_id, url_key))
```

`url_key` = normalized URL (lowercase host, sorted query, trailing-slash policy, fragment stripped) — used for dedupe/canonical normalization.

## Analysis outputs

```
seo_issues(id PK, tenant_id, website_id, run_id, page_id NULL,
           code, category[technical|onpage|content|aeo|geo|performance],
           severity[critical|high|medium|low],
           title, description, why_it_matters, recommendation, evidence JSON,
           status[new|in_progress|resolved|ignored],
           first_seen_at, last_seen_at, resolved_at, created_at, updated_at)

scores(id PK, tenant_id, website_id, run_id, overall, components JSON, methodology JSON, created_at)

keywords(id PK, tenant_id, website_id, term, source[crawl|gsc|import],
         intent[informational|commercial|transactional|navigational|local],
         volume NULL, difficulty NULL, current_rank NULL, ctr NULL,
         recommended_url, page_id NULL, occurrences, created_at, updated_at,
         UNIQUE(website_id, term, source))

questions(id PK, tenant_id, website_id, page_id NULL, text, intent, source[content|faq|aeo],
          priority[high|medium|low], recommended_answer NULL, recommended_url,
          schema_type, created_at)

topics(id PK, tenant_id, website_id, name, parent_id NULL, is_pillar, coverage[0-100],
       status[existing|missing|planned], created_at)

actions(id PK, tenant_id, website_id, issue_id NULL, title, description,
        priority, impact[high|medium|low], effort[high|medium|low],
        owner_user_id NULL, status[new|in_progress|review|approved|completed],
        due_date, source, created_at, updated_at, completed_at)

schema_markup(id PK, tenant_id, website_id, page_id NULL, schema_type, json_ld,
              status[draft|approved|implemented], created_at, updated_at)

internal_links(id PK, tenant_id, website_id, source_page_id→pages, target_page_id→pages,
               anchor_text, reason, priority, status[suggested|approved|applied], created_at)

content(id PK, tenant_id, website_id NULL, type, title, slug, body, meta JSON,
        status[draft|review|approved|published], channel[web|newsletter],
        source_content_id NULL, created_at, updated_at, deleted_at)

social_campaigns(id PK, tenant_id, website_id NULL, name, platform, audience, objective,
                 goal, status, created_at)
social_ideas(id PK, campaign_id→social_campaigns, category, title, hook, pain_point,
             emotional_angle, format, value, cta, platform, goal, selected, position)
social_scripts(id PK, idea_id→social_ideas, duration_sec, structure JSON, hook,
               scenes JSON, voiceover, caption, hashtags, version, created_at)
content_calendar(id PK, tenant_id, website_id NULL, publish_at, platform, topic, format,
                 hook, cta, status[planned|drafted|scheduled|published], content_id NULL,
                 social_script_id NULL, created_at)

reports(id PK, tenant_id, website_id, type, format[pdf|csv|json], status, params JSON,
        file_path, created_at, completed_at)

integrations(id PK, tenant_id, website_id NULL, provider[gsc|ga4|bing|wordpress|shopify|…],
             status[connected|pending|error|disconnected], credentials JSON, meta JSON,
             created_at, updated_at)

free_audits(id PK, url, email NULL, ip, score, snapshot JSON, created_at)
```

## Phase 2 — content, versions, scheduling

```
content_versions(id PK, tenant_id, content_id→content, version, title, body, meta JSON,
                 changes JSON, source[ai|manual|optimize|repurpose], status, created_at, approved_at)

schema_jobs(id PK, tenant_id, website_id, page_id NULL, schema_type, status, json_ld, error, created_at)

crawl_schedules(id PK, tenant_id, website_id→websites, frequency[daily|weekly|monthly],
                enabled, next_run_at, last_run_at, created_at)
```

`content.channel` also carries repurposed channel targets (`linkedin|x|instagram|newsletter|script|blog`) and `meta.format` records which one was produced. `websites.crawl_schedule` mirrors the active schedule for fast reads.

## Phase 3 — competitive intelligence

```
competitors(id PK, tenant_id, website_id→websites, url, name, status, score,
            overlap_keywords, last_audited_at, created_at, UNIQUE(website_id, url))

competitor_keywords(id PK, tenant_id, competitor_id→competitors, term, occurrences, created_at)

content_gaps(id PK, tenant_id, website_id→websites, competitor_id→competitors NULL,
             term, status[missing|planned|addressed|ignored], priority, created_at,
             UNIQUE(website_id, term))
```

## Phase 4 — copilot, experiments, visibility

```
copilot_threads(id PK, tenant_id, website_id NULL, title, created_at, updated_at)
copilot_messages(id PK, thread_id→copilot_threads, role, content, epistemic JSON, created_at)

experiments(id PK, tenant_id, website_id→websites, name, hypothesis, metric[ctr|rank|clicks|conversions],
            status[draft|running|paused|concluded], created_at)
experiment_variants(id PK, experiment_id→experiments, label, content_id NULL, payload JSON,
                    traffic_pct, result_value REAL NULL, created_at)

ai_visibility(id PK, tenant_id, website_id→websites, engine, query,
              brand_mentioned INTEGER NULL, competitor_mentions JSON, source_urls JSON,
              checked_at, created_at)
```

`brand_mentioned = NULL` means *unmeasured* (no AI-search integration) — it must never be stored as `0`, because "not mentioned" is a real observation that only a provider can make. `result_value = NULL` means the operator has not entered the metric yet.

## Phase 5 — agency, billing, CMS fixes

```
clients(id PK, tenant_id, name, contact, notes, status, created_at)
invoices(id PK, tenant_id, amount_usd, currency, period, status, provider, provider_ref, created_at)
cms_fixes(id PK, tenant_id, website_id→websites, issue_id→seo_issues NULL, provider,
          payload JSON, backup_ref, backup_content JSON, status[proposed|blocked|applied|verified|restored|discarded|failed],
          error, created_at, applied_at, verified_at)
```

`websites.client_id → clients` links a site to an agency client. `cms_fixes.backup_content` holds the pre-change post snapshot read from WordPress before any apply, so a restore is a real write-back rather than a dangling reference; `backup_ref` names it. `status = 'blocked'` means nothing was changed on the customer's site.

## Phase 6 — agent, revenue

```
agent_runs(id PK, tenant_id, run_date, summary, priorities JSON, opportunities JSON, created_at)
revenue_events(id PK, tenant_id, website_id NULL, source[organic|ai_search|social|referral|email|direct|manual],
               label, amount_usd, occurred_at, created_at)
```

`revenue_events` rows are **operator-recorded**; the system never infers revenue from traffic and never presents a modelled attribution as observed.

## Tenancy model (important)

Every table above is either:

1. **tenant-scoped** — has its own `tenant_id` FK, and every query filters on it; or
2. **parent-scoped** — child rows that inherit tenancy through their parent. Currently `copilot_messages` (via `copilot_threads`) and `experiment_variants` (via `experiments`). These deliberately carry no `tenant_id`; the API must verify the parent row belongs to the session's tenant *before* reading or writing the child. This invariant is enforced by tests in `src/lib/websites/tenancy.test.ts`.

Never filter a child table by the caller's tenant directly; always join or verify the parent first.


## Relationships (fan-out)

```
organizations 1─n memberships n─1 users
organizations 1─n websites 1─n crawl_runs 1─n crawl_urls
                     │            └──n pages 1─n seo_issues
                     ├──n keywords, questions, topics, actions, schema_markup, internal_links
                     ├──n content 1─n content_versions
                     ├──n competitors 1─n competitor_keywords, 1─n content_gaps
                     ├──n copilot_threads 1─n copilot_messages
                     ├──n experiments 1─n experiment_variants
                     ├──n ai_visibility, crawl_schedules, cms_fixes, revenue_events
                     └──n reports, integrations
organizations 1─n plans_usage, audit_logs, jobs, ai_usage, sessions, subscriptions, agent_runs, invoices, clients
```

## Indexes (minimum)

`users(email)`, `memberships(user_id)`, `sessions(token_hash)`,
`websites(tenant_id, normalized_url)`, `crawl_urls(run_id, status)`,
`pages(website_id, run_id)`, `seo_issues(website_id, status, severity)`,
`seo_issues(page_id)`, `keywords(website_id)`, `questions(website_id)`,
`actions(tenant_id, status)`, `jobs(status, run_at)`, `plans_usage(tenant_id, period)`,
`audit_logs(tenant_id, created_at)`, `ai_usage(tenant_id, created_at)`,
plus the Phase 2–6 additions: `content(tenant_id, website_id, status)`,
`content_versions(content_id, version)`, `competitors(website_id)`,
`content_gaps(website_id, status)`, `copilot_threads(tenant_id, website_id)`,
`copilot_messages(thread_id, created_at)`, `experiments(website_id, status)`,
`experiment_variants(experiment_id)`, `ai_visibility(website_id, created_at)`,
`crawl_schedules(tenant_id, enabled, next_run_at)`, `cms_fixes(website_id, status)`,
`agent_runs(tenant_id, run_date)`, `revenue_events(tenant_id, occurred_at)`.

## Migration policy

`schema.sql` is applied with `CREATE … IF NOT EXISTS` at boot; additive column changes go through an ordered, idempotent `MIGRATIONS[]` array tracked in `_migrations`. Destructive changes require a versioned migration + backup note in `11-infrastructure-architecture.md`.

Current migrations: 1) `pages.inbound_link_count` · 2) `websites.client_id` · 3) `websites.crawl_schedule` · 4) `free_audits.expires_at` · 5) `cms_fixes.backup_content`. New **tables** need only an idempotent `CREATE TABLE IF NOT EXISTS` in `schema.sql`; new **columns** always need a migration entry.
