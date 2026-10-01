import { all, newId, nowIso, row, run as sql } from "@/lib/db/db";
import { analyzeRun } from "@/lib/seo/analyze";
import { fetchText, isDisallowed, parseRobots, parseSitemap, DEFAULT_UA, FetchError } from "./fetcher";
import { parseHtml, type PageFacts } from "./parse";
import { resolveUrl, sameRegistrableDomain, normalizeUrlKey, isPrivateHost } from "@/lib/url";
import { getLimits } from "@/lib/plans";

const PER_PAGE_DELAY_MS = Number(process.env.CRAWLER_DELAY_MS || 250);
const MAX_DEPTH = 5;
const MAX_SITEMAPS = 5;

interface RunRow {
  id: string;
  tenant_id: string;
  website_id: string;
  status: string;
}

interface RunStats {
  robotsPresent: boolean;
  sitemapPresent: boolean;
  broken: Array<{ url: string; status: number; from: string }>;
  robotsSkipped: number;
  errors: number;
}

/**
 * Hands a crawl run back after the worker running it was lost.
 *
 * A run left `running` blocks every future crawl for that website: the API
 * refuses to start one while any run is `queued`/`running`, and the scheduler
 * skips it too. So a requeued job has to release the run, and a job that has
 * exhausted its attempts has to close it out rather than leave it dangling.
 */
export function releaseLostCrawlRun(
  runId: string,
  outcome: "retry" | "failed",
  reason: string
): void {
  if (outcome === "retry") {
    sql(
      "UPDATE crawl_runs SET status = 'queued', started_at = NULL, error = ? WHERE id = ? AND status = 'running'",
      reason.slice(0, 1000),
      runId
    );
    return;
  }
  sql(
    `UPDATE crawl_runs SET status = 'failed', finished_at = ?, error = ?
     WHERE id = ? AND status IN ('queued','running')`,
    nowIso(),
    reason.slice(0, 1000),
    runId
  );
}

export async function executeCrawl(runId: string, opts?: { maxPages?: number | null }): Promise<void> {
  const dbRun = row<RunRow>("SELECT * FROM crawl_runs WHERE id = ?", runId);
  if (!dbRun) throw new Error("crawl_run_not_found");
  if (dbRun.status === "cancelled") return;

  const website = row<{ id: string; normalized_url: string; tenant_id: string }>(
    "SELECT id, normalized_url, tenant_id FROM websites WHERE id = ?",
    dbRun.website_id
  );
  if (!website) throw new Error("website_not_found");

  const plan = row<{ plan: string }>(
    "SELECT plan FROM organizations WHERE id = ?",
    website.tenant_id
  );
  const maxPages = effectivePageCap(plan?.plan ?? "free", opts?.maxPages);

  sql("UPDATE crawl_runs SET status = 'running', started_at = ? WHERE id = ?", nowIso(), runId);

  const origin = new URL(website.normalized_url).origin;
  const stats: RunStats = {
    robotsPresent: false,
    sitemapPresent: false,
    broken: [],
    robotsSkipped: 0,
    errors: 0,
  };

  let disallowRules = parseRobots("");
  try {
    const robots = await fetchText(`${origin}/robots.txt`, { accept: "text/plain,*/*" });
    if (robots.status === 200) {
      stats.robotsPresent = true;
      disallowRules = parseRobots(robots.text, DEFAULT_UA);
    }
  } catch {
    // no robots.txt — crawl is still allowed
  }

  const sitemapUrls: string[] = [];
  const sitemapQueue = [...disallowRules.sitemaps];
  if (sitemapQueue.length === 0) sitemapQueue.push(`${origin}/sitemap.xml`);
  const seenSitemaps = new Set<string>();
  while (sitemapQueue.length > 0 && seenSitemaps.size < MAX_SITEMAPS) {
    const sm = sitemapQueue.shift();
    if (!sm || seenSitemaps.has(sm)) continue;
    seenSitemaps.add(sm);
    try {
      const res = await fetchText(sm, { accept: "application/xml,text/xml,*/*" });
      if (res.status !== 200) continue;
      const parsed = parseSitemap(res.text);
      if (parsed.kind === "urlset") {
        stats.sitemapPresent = true;
        for (const e of parsed.entries) sitemapUrls.push(e.loc);
      } else {
        for (const e of parsed.entries) sitemapQueue.push(e.loc);
      }
    } catch {
      // broken sitemap entry — skip
    }
  }

  const seeds = sitemapUrls
    .filter((u) => {
      try {
        return sameRegistrableDomain(u, website.normalized_url);
      } catch {
        return false;
      }
    })
    .slice(0, maxPages);
  if (seeds.length === 0) seeds.push(website.normalized_url);

  for (const url of seeds) insertFrontier(runId, url, 0, "sitemap");

  const linkFrom = new Map<string, string>();
  const internalLinks: Array<{ fromPageId: string; toKey: string }> = [];
  let analyzed = 0;
  let bytes = 0;
  let responseMsTotal = 0;
  let responseCount = 0;

  for (;;) {
    const state = row<{ status: string }>("SELECT status FROM crawl_runs WHERE id = ?", runId);
    if (state?.status === "cancelled") break;
    if (analyzed >= maxPages) break;

    const next = row<{ id: string; url: string; url_key: string; depth: number; attempts: number }>(
      `SELECT id, url, url_key, depth, attempts FROM crawl_urls
       WHERE run_id = ? AND status = 'pending' ORDER BY depth ASC, rowid ASC LIMIT 1`,
      runId
    );
    if (!next) break;

    if (stats.robotsPresent && isDisallowed(new URL(next.url).pathname, disallowRules)) {
      sql("UPDATE crawl_urls SET status = 'skipped', error = 'robots' WHERE id = ?", next.id);
      stats.robotsSkipped++;
      continue;
    }

    try {
      const res = await fetchText(next.url);
      const contentType = res.headers.get("content-type") ?? "";
      sql(
        "UPDATE crawl_urls SET http_status = ?, attempts = attempts + 1, fetched_at = ? WHERE id = ?",
        res.status,
        nowIso(),
        next.id
      );
      bytes += res.bytes;
      responseMsTotal += res.ttfbMs;
      responseCount++;

      if (res.status >= 400) {
        sql("UPDATE crawl_urls SET status = 'done' WHERE id = ?", next.id);
        stats.broken.push({
          url: next.url,
          status: res.status,
          from: linkFrom.get(next.url_key) ?? website.normalized_url,
        });
        upsertPage(website.tenant_id, website.id, runId, next, res, null, null);
        analyzed++;
        updateProgress(runId, analyzed, bytes, responseMsTotal, responseCount, stats);
        continue;
      }

      if (!/html|xml/i.test(contentType)) {
        sql(
          "UPDATE crawl_urls SET status = 'skipped', error = 'content-type' WHERE id = ?",
          next.id
        );
        continue;
      }

      const facts = parseHtml(res.text);
      const finalKey = safeKey(res.finalUrl);
      const pageId = upsertPage(website.tenant_id, website.id, runId, next, res, facts, finalKey);

      for (const href of facts.linkHrefs) {
        const abs = resolveUrl(href, res.finalUrl);
        if (!abs) continue;
        try {
          const target = new URL(abs);
          if (isPrivateHost(target.hostname)) continue;
          if (!sameRegistrableDomain(abs, website.normalized_url)) continue;
          const key = normalizeUrlKey(target);
          if (!linkFrom.has(key)) linkFrom.set(key, res.finalUrl);
          internalLinks.push({ fromPageId: pageId, toKey: key });
          const targetDepth = next.depth + 1;
          if (targetDepth <= MAX_DEPTH) insertFrontier(runId, abs, targetDepth, "link");
        } catch {
          // malformed link — skip
        }
      }

      sql("UPDATE crawl_urls SET status = 'done' WHERE id = ?", next.id);
      analyzed++;
      updateProgress(runId, analyzed, bytes, responseMsTotal, responseCount, stats);
    } catch (e) {
      const attempts = next.attempts + 1;
      const message = e instanceof FetchError ? `${e.code}: ${e.message}` : String(e);
      if (attempts < 2 && !(e instanceof FetchError && e.code === "ssrf")) {
        sql(
          "UPDATE crawl_urls SET status = 'pending', attempts = ?, error = ? WHERE id = ?",
          attempts,
          message.slice(0, 300),
          next.id
        );
      } else {
        sql(
          "UPDATE crawl_urls SET status = 'error', attempts = ?, error = ? WHERE id = ?",
          attempts,
          message.slice(0, 300),
          next.id
        );
        stats.errors++;
      }
    }

    await sleep(PER_PAGE_DELAY_MS);
  }

  const inbound = new Map<string, number>();
  for (const l of internalLinks) inbound.set(l.toKey, (inbound.get(l.toKey) ?? 0) + 1);
  sql("UPDATE pages SET inbound_link_count = 0 WHERE website_id = ? AND run_id = ?", website.id, runId);
  for (const [key, count] of inbound) {
    sql(
      "UPDATE pages SET inbound_link_count = ? WHERE website_id = ? AND url_key = ?",
      count,
      website.id,
      key
    );
  }

  const finalStatus = row<{ status: string }>("SELECT status FROM crawl_runs WHERE id = ?", runId);
  const status = finalStatus?.status === "cancelled" ? "cancelled" : "done";
  const discovered = row<{ n: number }>(
    "SELECT COUNT(*) AS n FROM crawl_urls WHERE run_id = ?",
    runId
  );
  sql(
    "UPDATE crawl_runs SET status = ?, finished_at = ?, pages_discovered = ?, stats = ? WHERE id = ?",
    status,
    nowIso(),
    discovered?.n ?? analyzed,
    JSON.stringify(stats),
    runId
  );
  sql("UPDATE websites SET last_crawled_at = ? WHERE id = ?", nowIso(), website.id);

  if (status === "done") {
    const analysis = analyzeRun({
      tenantId: website.tenant_id,
      websiteId: website.id,
      runId,
      plan: plan?.plan ?? "free",
    });
    if (analysis.keywordCapHit) {
      // Tracked-keyword allowance spent: record it so reports can say the list is capped
      // rather than implying the crawl saw every term on the page.
      sql(
        "UPDATE crawl_runs SET stats = json_set(COALESCE(NULLIF(stats, ''), '{}'), '$.keywordCapHit', json('true')) WHERE id = ?",
        runId
      );
    }
  }
}

function planPageLimit(plan: string): number {
  return getLimits(plan).pagesPerCrawl;
}

/**
 * The real page budget for a crawl: the smallest of what the caller asked for,
 * the plan's `pagesPerCrawl`, and the operator's `CRAWLER_MAX_PAGES` safety cap.
 * Single source of truth so the API can report the same number the crawler uses.
 */
export function effectivePageCap(plan: string, requested?: number | null): number {
  const caps = [planPageLimit(plan), Number(process.env.CRAWLER_MAX_PAGES || 200)];
  if (requested && requested > 0) caps.push(requested);
  return Math.min(...caps);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function safeKey(url: string): string {
  try {
    return normalizeUrlKey(new URL(url));
  } catch {
    return url;
  }
}

function insertFrontier(runId: string, url: string, depth: number, source: string): void {
  let key: string;
  try {
    key = normalizeUrlKey(new URL(url));
  } catch {
    return;
  }
  sql(
    `INSERT OR IGNORE INTO crawl_urls (id, run_id, url, url_key, depth, source, status)
     VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
    newId("cu"),
    runId,
    url,
    key,
    depth,
    source
  );
}

function upsertPage(
  tenantId: string,
  websiteId: string,
  runId: string,
  frontier: { id: string; url: string; url_key: string; depth: number },
  res: { status: number; finalUrl: string; ttfbMs: number; bytes: number; headers: Headers },
  facts: PageFacts | null,
  finalKey: string | null
): string {
  const now = nowIso();
  const key = finalKey ?? frontier.url_key;
  const cols: Record<string, string | number | null> = {
    url: res.finalUrl,
    url_key: key,
    status_code: res.status,
    redirect_url: res.finalUrl !== frontier.url ? res.finalUrl : null,
    content_type: res.headers.get("content-type"),
    depth: frontier.depth,
    title: facts?.title ?? null,
    title_len: facts?.titleLen ?? 0,
    meta_description: facts?.metaDescription ?? null,
    meta_desc_len: facts?.metaDescLen ?? 0,
    h1: facts?.h1 ?? null,
    headings: JSON.stringify(facts?.headings ?? []),
    canonical: facts?.canonical ?? null,
    robots_meta: facts?.robotsMeta ?? null,
    is_indexable: facts ? (facts.isIndexable ? 1 : 0) : 0,
    word_count: facts?.wordCount ?? 0,
    lang: facts?.lang ?? null,
    internal_link_count: 0,
    external_link_count: 0,
    image_count: facts?.imageCount ?? 0,
    images_missing_alt: facts?.imagesMissingAlt ?? 0,
    html_bytes: facts?.htmlBytes ?? res.bytes,
    ttfb_ms: res.ttfbMs,
    has_structured_data: facts?.hasStructuredData ? 1 : 0,
    structured_types: JSON.stringify(facts?.structuredTypes ?? []),
    og_title: facts?.ogTitle ?? null,
    og_description: facts?.ogDescription ?? null,
    og_image: facts?.ogImage ?? null,
    text_sample: facts?.textSample ?? "",
    run_id: runId,
    fetched_at: now,
  };

  const existing = row<{ id: string }>(
    "SELECT id FROM pages WHERE website_id = ? AND url_key = ?",
    websiteId,
    key
  );
  const keys = Object.keys(cols);
  const values = Object.values(cols);

  if (existing) {
    sql(
      `UPDATE pages SET ${keys.map((k) => `${k} = ?`).join(", ")} WHERE id = ?`,
      ...(values as never[]),
      existing.id
    );
    return existing.id;
  }

  const id = newId("pg");
  sql(
    `INSERT INTO pages (id, tenant_id, website_id, ${keys.join(", ")})
     VALUES (?, ?, ?, ${keys.map(() => "?").join(", ")})`,
    id,
    tenantId,
    websiteId,
    ...(values as never[])
  );
  return id;
}

function updateProgress(
  runId: string,
  analyzed: number,
  bytes: number,
  responseMsTotal: number,
  responseCount: number,
  stats: RunStats
): void {
  const discovered = row<{ n: number }>(
    "SELECT COUNT(*) AS n FROM crawl_urls WHERE run_id = ?",
    runId
  );
  sql(
    `UPDATE crawl_runs SET pages_analyzed = ?, bytes_downloaded = ?, avg_response_ms = ?,
       pages_discovered = ?, stats = ? WHERE id = ?`,
    analyzed,
    bytes,
    responseCount > 0 ? Math.round(responseMsTotal / responseCount) : 0,
    discovered?.n ?? analyzed,
    JSON.stringify(stats),
    runId
  );
}

export function crawlSummary(runId: string) {
  const pending = row<{ n: number }>(
    "SELECT COUNT(*) AS n FROM crawl_urls WHERE run_id = ? AND status = 'pending'",
    runId
  );
  const skipped = row<{ n: number }>(
    "SELECT COUNT(*) AS n FROM crawl_urls WHERE run_id = ? AND status = 'skipped'",
    runId
  );
  return { pending: pending?.n ?? 0, skipped: skipped?.n ?? 0 };
}

export function listRecentRuns(tenantId: string, websiteId: string, limit = 10) {
  return all(
    `SELECT id, status, trigger, pages_discovered, pages_analyzed, issues_found,
            keywords_found, questions_found, started_at, finished_at, error, created_at
     FROM crawl_runs WHERE tenant_id = ? AND website_id = ? ORDER BY created_at DESC LIMIT ?`,
    tenantId,
    websiteId,
    limit
  );
}
