import { newId, nowIso, run } from "@/lib/db/db";
import { fetchText, isDisallowed, parseRobots, parseSitemap, FetchError } from "@/lib/crawler/fetcher";
import { parseHtml, type PageFacts } from "@/lib/crawler/parse";
import { ALL_CHECKS } from "@/lib/seo/checks";
import { computeScore } from "@/lib/scoring/score";
import type { CheckContext, CheckOutcome, PageLite } from "@/lib/seo/types";
import { normalizeWebsiteUrl, UrlError } from "@/lib/url";
import { retentionDeadline } from "./free-retention";

export class FreeAuditError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "invalid_url"
      | "robots_blocked"
      | "fetch_failed"
      | "not_html"
      | "rate_limited"
  ) {
    super(message);
  }
}

export interface AuditedPage {
  url: string;
  finalUrl: string;
  status: number;
  page: PageLite;
  facts: PageFacts;
  robotsPresent: boolean;
  sitemapPresent: boolean;
}

export interface AuditedScore {
  score: ReturnType<typeof computeScore>;
  outcomes: CheckOutcome[];
}

const SEVERITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

/**
 * Fetch + parse + score a single public URL. Shared by the free audit and
 * competitor audits. Never persists anything — callers decide storage.
 * SSRF-guarded by fetchText.
 */
export async function auditUrl(input: { url: string }): Promise<{ page: AuditedPage; scored: AuditedScore }> {
  let normalized;
  try {
    normalized = normalizeWebsiteUrl(input.url);
  } catch (e) {
    if (e instanceof UrlError) throw new FreeAuditError(e.message, "invalid_url");
    throw e;
  }

  const origin = new URL(normalized.normalized).origin;
  const path = new URL(normalized.normalized).pathname;

  let robotsPresent = false;
  let rules = parseRobots("");
  try {
    const res = await fetchText(`${origin}/robots.txt`, { accept: "text/plain,*/*" });
    if (res.status === 200) {
      robotsPresent = true;
      rules = parseRobots(res.text);
    }
  } catch {
    // robots.txt missing or unreachable — crawling stays allowed
  }
  if (robotsPresent && isDisallowed(path, rules)) {
    throw new FreeAuditError(
      "This URL is disallowed by the site's robots.txt, so we won't audit it.",
      "robots_blocked"
    );
  }

  let sitemapPresent = false;
  try {
    const res = await fetchText(`${origin}/sitemap.xml`, {
      accept: "application/xml,text/xml,*/*",
    });
    if (res.status === 200) sitemapPresent = parseSitemap(res.text).entries.length > 0;
  } catch {
    // no sitemap — recorded as absent
  }

  let res;
  try {
    res = await fetchText(normalized.normalized);
  } catch (e) {
    if (e instanceof FetchError) {
      throw new FreeAuditError(
        e.code === "ssrf"
          ? "That address is not reachable from the public internet."
          : `Could not fetch the page: ${e.message}`,
        "fetch_failed"
      );
    }
    throw e;
  }
  if (res.status >= 400) {
    throw new FreeAuditError(`The page returned HTTP ${res.status}.`, "fetch_failed");
  }
  const contentType = res.headers.get("content-type") ?? "";
  if (!/html/i.test(contentType)) {
    throw new FreeAuditError("Only HTML pages can be audited.", "not_html");
  }

  const facts = parseHtml(res.text);
  const page = buildPageLite(normalized.normalized, res, facts);

  const ctx: CheckContext = {
    website: { id: "audit", url: normalized.normalized, normalized_url: normalized.normalized, primary_keywords: null },
    pages: [page],
    robotsPresent,
    sitemapPresent,
    inboundLinks: new Map([[page.id, 0]]),
    sameSiteUrlKeys: new Set([page.url_key]),
    brokenInternalUrls: [],
  };

  const outcomes: CheckOutcome[] = ALL_CHECKS.map((check) => check(ctx));
  const score = computeScore(outcomes, {
    linked: page.is_indexable === 1 && page.inbound_link_count > 0 ? 1 : 0,
    total: page.is_indexable === 1 ? 1 : 0,
  });

  return {
    page: {
      url: normalized.normalized,
      finalUrl: res.finalUrl,
      status: res.status,
      page,
      facts,
      robotsPresent,
      sitemapPresent,
    },
    scored: { score, outcomes },
  };
}

export interface FreeAuditIssue {
  code: string;
  category: string;
  severity: string;
  title: string;
  recommendation: string;
}

export interface FreeAuditResult {
  auditId: string;
  url: string;
  score: number;
  components: Record<string, { score: number; weight: number }>;
  issues: FreeAuditIssue[];
  issueCount: number;
  page: { title: string | null; wordCount: number; status: number };
  robotsPresent: boolean;
  sitemapPresent: boolean;
  measuredAt: string;
}

const MAX_TOP_ISSUES = 6;

/** Single-page, rate-limited public audit. Never persists tenant data. */
export async function runFreeAudit(input: {
  url: string;
  ip: string;
  email?: string | null;
}): Promise<FreeAuditResult> {
  const { page, scored } = await auditUrl({ url: input.url });
  const { score, outcomes } = scored;

  const flat: Array<{ issue: FreeAuditIssue; order: number }> = [];
  let issueCount = 0;
  for (const outcome of outcomes) {
    issueCount += outcome.failures.length;
    if (outcome.failures.length === 0) continue;
    flat.push({
      issue: {
        code: outcome.code,
        category: outcome.category,
        severity: outcome.severity,
        title: outcome.title,
        recommendation: outcome.recommendation,
      },
      order: SEVERITY_ORDER[outcome.severity] ?? 4,
    });
  }
  flat.sort((a, b) => a.order - b.order);
  const topIssues = flat.slice(0, MAX_TOP_ISSUES).map((f) => f.issue);

  const measuredAt = nowIso();
  const auditId = newId("aud");
  run(
    `INSERT INTO free_audits (id, url, email, ip, score, snapshot, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    auditId,
    input.url,
    input.email ?? null,
    input.ip,
    score.overall,
    JSON.stringify({
      issueCount,
      topIssueCodes: topIssues.map((i) => i.code),
      components: Object.fromEntries(
        Object.entries(score.components).map(([k, v]) => [k, { score: v.score, weight: v.weight }])
      ),
      robotsPresent: page.robotsPresent,
      sitemapPresent: page.sitemapPresent,
      title: page.page.title,
      wordCount: page.page.word_count,
    }),
    measuredAt,
    // Retention deadline: this row holds an email and an IP, so it gets a
    // deletion date rather than being kept indefinitely.
    retentionDeadline(new Date(measuredAt))
  );

  const components: FreeAuditResult["components"] = {};
  for (const [k, v] of Object.entries(score.components)) {
    components[k] = { score: v.score, weight: v.weight };
  }

  return {
    auditId,
    url: page.finalUrl,
    score: score.overall,
    components,
    issues: topIssues,
    issueCount,
    page: { title: page.page.title, wordCount: page.page.word_count, status: page.page.status_code ?? 0 },
    robotsPresent: page.robotsPresent,
    sitemapPresent: page.sitemapPresent,
    measuredAt,
  };
}

function buildPageLite(
  requestedUrl: string,
  res: { status: number; finalUrl: string; ttfbMs: number; bytes: number; headers: Headers },
  facts: PageFacts
): PageLite {
  let urlKey = requestedUrl;
  try {
    const u = new URL(res.finalUrl);
    u.hash = "";
    urlKey = `${u.origin}${u.pathname}${u.search}`;
  } catch {
    // keep requested URL as key
  }

  return {
    id: "free-page",
    url: res.finalUrl,
    url_key: urlKey,
    status_code: res.status,
    redirect_url: res.finalUrl !== requestedUrl ? res.finalUrl : null,
    content_type: res.headers.get("content-type"),
    depth: 0,
    title: facts.title,
    title_len: facts.titleLen,
    meta_description: facts.metaDescription,
    meta_desc_len: facts.metaDescLen,
    h1: facts.h1,
    headings: JSON.stringify(facts.headings),
    canonical: facts.canonical,
    robots_meta: facts.robotsMeta,
    is_indexable: facts.isIndexable ? 1 : 0,
    word_count: facts.wordCount,
    lang: facts.lang,
    internal_link_count: facts.linkHrefs.length,
    external_link_count: 0,
    inbound_link_count: 0,
    image_count: facts.imageCount,
    images_missing_alt: facts.imagesMissingAlt,
    html_bytes: facts.htmlBytes,
    ttfb_ms: res.ttfbMs,
    has_structured_data: facts.hasStructuredData ? 1 : 0,
    structured_types: JSON.stringify(facts.structuredTypes),
    og_title: facts.ogTitle,
    og_description: facts.ogDescription,
    text_sample: facts.textSample,
  };
}
