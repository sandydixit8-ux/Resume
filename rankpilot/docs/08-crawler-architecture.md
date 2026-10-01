# RankPilot AI — Crawler Architecture

## 1. Goals

Fetch a website like a respectful search engine: robots-compliant, rate-limited, deterministic, restartable — and turn each page into structured analysis data.

## 2. Pipeline

```
enqueue(runId, seedUrl)
  → discovery (robots.txt → sitemap.xml(s) → link frontier)
  → normalized frontier (url_key dedupe, depth filter, limits)
  → fetch queue (per-host rate limit, timeout, retries, redirect tracking)
  → parse (HTML → DOM facts)
  → normalize (canonical, indexability, text extraction)
  → persist (crawl_urls, pages)
  → analyze (technical + on-page + scoring)  ← separate job, same run
  → finalize (run stats, issues, keywords, questions, scores)
```

## 3. Discovery

1. `GET /robots.txt` (5s timeout): parse `Sitemap:` lines + `Disallow` rules for our UA.
2. Parse all referenced sitemaps (`urlset` and `sitemapindex`, nested up to depth 2, max 5 files).
3. Frontier seeded from sitemap URLs; if no sitemap, seed = origin URL and crawl by link discovery only.
4. BFS by depth, `maxDepth` default 5, `maxPages` from plan (default 200 MVP).

**Robots policy**: a URL disallowed for `RankPilotBot` (or `*`) is *recorded as skipped* (`crawl_urls.status='skipped'`) but not fetched. Pages disallowed for us are still counted in discovery stats, and the dashboard surfaces "N pages disallowed by robots.txt" as an informational issue — we never fetch what robots forbids.

## 4. Politeness & safety

| Control | Value |
|---|---|
| Per-host concurrency | 1 |
| Per-host delay | 250 ms (configurable) |
| Timeout | `CRAWLER_TIMEOUT_MS` (15 s default) |
| Retries | 2, backoff 1s/3s, only for network errors & 429/5xx |
| Redirects | follow max 5, record chain, detect loops |
| Body cap | 2 MB per response |
| User-Agent | `RankPilotBot/1.0 (+https://rankpilot.ai/bot)` (configurable) |
| SSRF guard | resolve host → reject private/loopback/link-local/metadata IPs (10/8, 172.16/12, 192.168/16, 127/8, 169.254/16, ::1, fc00::/7); http→https upgrade when site supports it |
| Content types | `text/html` only for analysis; others recorded as `skipped` |
| Canonical normalization | lowercase host, strip default ports, strip fragment, sort query, remove tracking params (`utm_*`, `gclid`, `fbclid`), trailing-slash policy by path depth → `url_key` |

## 5. Parse pipeline (per page)

Extract and store on `pages`:

- status, redirect target, content-type, TTFB, html bytes, depth
- `<title>` (+length), meta description (+length), canonical, robots meta, lang
- H1 list, heading outline (H1–H3 JSON), indexability decision
- links → internal (same registrable domain) / external counts, candidate URLs pushed to frontier
- images count + missing `alt`, oversized image hints (from attributes when present)
- structured data: all `application/ld+json` blocks parsed → types list
- Open Graph basics
- word count + `text_sample` (first ~4k chars, script/style/nav stripped) — used by content/AEO/keyword analyzers

Per-field caps, because the page is attacker-controlled and every stored field is re-read into an AI prompt:

| Field | Cap | Why |
| --- | --- | --- |
| `text_sample` | 4,000 chars | Bounds prompt size and cost per page. |
| heading text | 300 chars each | Bounds one pathological tag. |
| heading count | 200 per page | A page of nothing but `<h3>` tags would otherwise store megabytes of JSON and be re-scanned once per tracked keyword in `analyzeRun`. Real pages have a few dozen. |
| response body | 2 MB | Fetch-level cap, before parsing. |

Truncation is deterministic and keeps document order (the first N headings). It is a deliberate data-loss tradeoff: the dropped headings carry no SEO signal a real page would have, and the alternative is unbounded storage and prompt cost from a page the user chose to crawl.

Parser uses a tolerant HTML tokenizer (regex-assisted state machine, no external dep in MVP) with tests against fixtures: valid HTML, broken/nested HTML, JS-heavy shell (little text → flagged), multilingual content.

## 6. Job model

`crawl_runs.status`: `queued → running → done | failed`.

Progress counters updated incrementally (so `/api/crawl-runs/:id` polling is cheap): `pages_discovered`, `pages_analyzed`, `issues_found`, `keywords_found`, `questions_found`, `bytes_downloaded`, `avg_response_ms`.

Failure handling: run fails only on seed-URL failure or exceeding retry budget globally; partial results are kept and marked `failed` with `error` — dashboard shows what was analyzed plus a retry button.

Concurrency: one active run per website (second `POST /crawl` while running → `409 conflict`). Jobs are claimed atomically (`UPDATE jobs SET status='running' … WHERE status='pending' AND run_at<=now` with `changes=1` check) so multiple workers can coexist later.

## 7. Analysis phase (same run, deterministic)

Order: technical checks → on-page checks → keyword/question discovery → scoring → actions creation for top issues. Each check lives in `src/lib/seo/checks/*` as:

```ts
{ code, category, severity, title, why, recommend(ctx): Issue[] }
```

Checks are pure functions over the page set + run facts → fully unit-tested, explainable, and reusable by the free-audit endpoint.

## 8. Scale path

MVP: in-process worker, 200 pages/run. Later: move `crawl.*` jobs to a dedicated worker process (same code), add per-host queues, page-result streaming, and object storage for raw HTML snapshots. Schema already separates `crawl_runs` (job) from `crawl_urls` (frontier) and `pages` (results) so nothing structural changes.
