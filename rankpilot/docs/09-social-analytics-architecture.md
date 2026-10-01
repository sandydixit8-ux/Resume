# RankPilot AI — Social Analytics Architecture

Scope: V2 data plane. Documented now so the MVP's social generation modules (`social_campaigns/ideas/scripts/calendar`) emit shapes that analytics can consume without rework.

## 1. Principles

1. **Only observable metrics.** Values come from official platform APIs (or explicit user CSV import). No estimates, no "predicted reach".
2. **Normalize, don't flatten.** Platform metrics keep their native meaning; a shared layer defines comparable *concepts*.
3. **Provenance everywhere.** Every metric row stores `source` (api|import|manual) + `collected_at` + `account_id`.
4. **No vanity guarantees.** Reports describe what happened; they never claim causality or predict virality.

## 2. Connector layer

```
src/lib/social/connectors/
  types.ts        SocialConnector { authUrl, fetchMetrics(range), fetchPosts(range), health }
  instagram.ts    Graph API: reach, impressions, plays, saves, shares, comments, likes,
                  follows, profile_views, link_clicks (business accounts)
  facebook.ts     Page insights: reach, impressions, reactions, comments, shares, clicks
  youtube.ts      Data API v3: views, watchTime, avgViewDuration, likes, comments,
                  subscribers_gained, impressions (Analytics API)
  linkedin.ts     Organization/page posts: impressions, clicks, reactions, comments, shares
  x.ts            API v2: impressions, engagements, likes, replies, reposts, profile clicks
  pinterest.ts    impressions, saves, outbound clicks
  tiktok.ts       video views, watch time, likes, comments, shares, profile views
  csv_import.ts   universal fallback: user uploads platform export → column mapping → same schema
```

Each connector: OAuth2 where available (tokens in `integrations.credentials`, encrypted at rest), pagination, quota-aware backoff, `status` on the integration row (`connected|pending|error|disconnected`) surfaced in Settings.

## 3. Normalized schema

```
social_accounts(id, tenant_id, website_id NULL, provider, handle, followers,
                connected_at, status, meta JSON)

social_posts(id, tenant_id, account_id, provider, external_id, campaign_id NULL,
             idea_id NULL, script_id NULL, content_id NULL,
             type[reel|short|video|image|carousel|text|story],
             published_at, permalink, caption, hook, duration_sec, thumbnail)

social_metrics(id, tenant_id, account_id, post_id NULL, metric_date,
               -- funnel, normalized names
               impressions, reach, views, watch_time_sec, avg_watch_time_sec,
               retention_pct, likes, comments, shares, saves,
               profile_visits, website_clicks, followers_gained, conversions,
               raw JSON, source, collected_at)
```

Daily grain per post (plus account-level rows with `post_id NULL`). `raw` keeps the untouched API payload for audits.

## 4. Normalization rules (comparable concepts)

| Concept | Definition | Platform notes |
|---|---|---|
| `reach` | unique accounts shown content | TikTok reports views → mapped to `views`, `reach=null` |
| `views` | total plays | IG Reels ≈ plays; YT = views |
| `watch_time_sec` | total seconds viewed | LinkedIn gives 25/50/75/100% buckets → estimated with labeled flag |
| `retention_pct` | avg % watched | available for YT/IG/TikTok; null elsewhere |
| `engagement_rate` | (likes+comments+shares+saves)/reach | computed only when `reach` present |
| `ctr` | website_clicks/impressions | computed, null if denominator missing |

Anything not provided by the API stays `null` — the UI renders "Not reported by this platform", never a guess.

## 5. Collection pipeline

- `social.sync` job (daily, per connected account; per-provider rate limits) → connector fetch → upsert `social_posts` + `social_metrics`.
- Incremental: sync looks back 7 days to catch late-arriving metrics; full backfill on first connect (30 days MVP).
- Failures mark integration `error` with reason; other accounts unaffected.

## 6. Derived intelligence (reads only, no fabrication)

- **Content DNA** (`content_dna`): aggregates the tenant's own posts → best topics/hooks/formats/durations/posting windows by metric percentile. Labelled "Based on your N published posts".
- **Experiment lab** (`content_experiments`): A/B variants linked to `social_posts`; winner computed only after both variants have ≥ min impressions (`minSample`, default 1000) — otherwise status stays `collecting data`.
- **Reports**: pulls from `social_metrics`; every chart tooltip exposes source + collected_at.

## 7. MVP bridge

MVP ships generation only (ideas, hooks, scripts, captions, calendar) and stores them so that when connectors land (V2), published items already have `idea_id/script_id` linkage — analytics works retroactively on any manually imported posts via `csv_import`.
