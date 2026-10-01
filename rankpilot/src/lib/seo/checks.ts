import { countWords } from "@/lib/crawler/parse";
import type { Check, CheckContext, CheckOutcome, PageLite } from "./types";

const TITLE_MIN = 15;
const TITLE_MAX = 60;
const META_MIN = 50;
const META_MAX = 160;
const THIN_WORDS = 300;
const SLOW_MS = 1500;
const VERY_SLOW_MS = 3000;
const LARGE_HTML = 150_000;
const MAX_DEPTH = 4;

function indexable(ctx: CheckContext): PageLite[] {
  return ctx.pages.filter(
    (p) => p.is_indexable === 1 && (p.status_code ?? 200) >= 200 && (p.status_code ?? 200) < 300
  );
}

function groupBy<T>(items: T[], key: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const arr = m.get(k);
    if (arr) arr.push(item);
    else m.set(k, [item]);
  }
  return m;
}

function outcome(
  base: Omit<CheckOutcome, "applicable" | "failures">,
  applicable: number,
  failures: CheckOutcome["failures"]
): CheckOutcome {
  return { ...base, applicable, failures };
}

export const missingTitle: Check = (ctx) => {
  const failures = ctx.pages
    .filter((p) => !p.title || p.title.trim() === "")
    .map((p) => ({ pageId: p.id, pageUrl: p.url, detail: "No <title> tag" }));
  return outcome(
    {
      code: "T001",
      category: "technical",
      severity: "high",
      title: "Pages missing a title tag",
      whyItMatters: "The title is the primary label search engines and AI systems use to understand and display a page.",
      recommendation: "Add a unique, descriptive title (15–60 characters) containing the page's main topic.",
      weight: 10,
    },
    ctx.pages.length,
    failures
  );
};

export const shortLongTitle: Check = (ctx) => {
  const failures: CheckOutcome["failures"] = [];
  for (const p of ctx.pages) {
    if (!p.title) continue;
    if (p.title_len < TITLE_MIN) {
      failures.push({
        pageId: p.id,
        pageUrl: p.url,
        detail: `Title is ${p.title_len} chars (under ${TITLE_MIN})`,
        evidence: { title: p.title },
      });
    } else if (p.title_len > TITLE_MAX) {
      failures.push({
        pageId: p.id,
        pageUrl: p.url,
        detail: `Title is ${p.title_len} chars (over ${TITLE_MAX})`,
        evidence: { title: p.title },
      });
    }
  }
  return outcome(
    {
      code: "T003",
      category: "technical",
      severity: "medium",
      title: "Titles that are too short or too long",
      whyItMatters: "Titles outside 15–60 characters are frequently truncated or judged as low-signal.",
      recommendation: "Rewrite titles to 15–60 characters that state the page's topic plainly.",
      weight: 5,
    },
    ctx.pages.filter((p) => p.title).length,
    failures
  );
};

export const duplicateTitles: Check = (ctx) => {
  const withTitle = ctx.pages.filter((p) => p.title);
  const groups = groupBy(withTitle, (p) => p.title!.toLowerCase());
  const failures: CheckOutcome["failures"] = [];
  for (const [title, pages] of groups) {
    if (pages.length > 1) {
      failures.push({
        detail: `"${title.slice(0, 60)}" used on ${pages.length} pages`,
        evidence: { urls: pages.slice(0, 5).map((p) => p.url) },
      });
    }
  }
  return outcome(
    {
      code: "T002",
      category: "technical",
      severity: "high",
      title: "Duplicate title tags",
      whyItMatters: "Identical titles make pages compete with each other and dilute topical clarity.",
      recommendation: "Give each page a distinct title reflecting its unique topic.",
      weight: 8,
    },
    withTitle.length,
    failures
  );
};

export const missingMeta: Check = (ctx) => {
  const failures = ctx.pages
    .filter((p) => !p.meta_description || p.meta_description.trim() === "")
    .map((p) => ({ pageId: p.id, pageUrl: p.url, detail: "No meta description" }));
  return outcome(
    {
      code: "T005",
      category: "technical",
      severity: "high",
      title: "Pages missing a meta description",
      whyItMatters: "Descriptions shape the snippet shown in search results and influence click-through.",
      recommendation: "Write a unique 50–160 character summary that describes the page and its value.",
      weight: 7,
    },
    ctx.pages.length,
    failures
  );
};

export const duplicateMeta: Check = (ctx) => {
  const withMeta = ctx.pages.filter((p) => p.meta_description);
  const groups = groupBy(withMeta, (p) => p.meta_description!.toLowerCase());
  const failures: CheckOutcome["failures"] = [];
  for (const [desc, pages] of groups) {
    if (pages.length > 1) {
      failures.push({
        detail: `Same description on ${pages.length} pages`,
        evidence: { urls: pages.slice(0, 5).map((p) => p.url), snippet: desc.slice(0, 80) },
      });
    }
  }
  return outcome(
    {
      code: "T006",
      category: "technical",
      severity: "medium",
      title: "Duplicate meta descriptions",
      whyItMatters: "Duplicated snippets fail to differentiate pages in search results.",
      recommendation: "Write a distinct description for each page.",
      weight: 4,
    },
    withMeta.length,
    failures
  );
};

export const metaLength: Check = (ctx) => {
  const failures: CheckOutcome["failures"] = [];
  for (const p of ctx.pages) {
    if (!p.meta_description) continue;
    if (p.meta_desc_len < META_MIN || p.meta_desc_len > META_MAX) {
      failures.push({
        pageId: p.id,
        pageUrl: p.url,
        detail: `Description is ${p.meta_desc_len} chars (target ${META_MIN}–${META_MAX})`,
      });
    }
  }
  return outcome(
    {
      code: "T007",
      category: "technical",
      severity: "low",
      title: "Meta descriptions outside the ideal length",
      whyItMatters: "Descriptions are truncated or under-filled when outside the typical length range.",
      recommendation: `Keep descriptions between ${META_MIN} and ${META_MAX} characters.`,
      weight: 3,
    },
    ctx.pages.filter((p) => p.meta_description).length,
    failures
  );
};

export const missingH1: Check = (ctx) => {
  const failures = indexable(ctx)
    .filter((p) => !p.h1)
    .map((p) => ({ pageId: p.id, pageUrl: p.url, detail: "No H1 heading" }));
  return outcome(
    {
      code: "T008",
      category: "technical",
      severity: "high",
      title: "Pages missing an H1 heading",
      whyItMatters: "The H1 states the page's main subject for readers, search engines and answer engines.",
      recommendation: "Add one H1 that clearly names the page's primary topic.",
      weight: 8,
    },
    indexable(ctx).length,
    failures
  );
};

export const multipleH1: Check = (ctx) => {
  const failures: CheckOutcome["failures"] = [];
  for (const p of indexable(ctx)) {
    const headings = safeHeadings(p);
    const h1s = headings.filter((h) => h.level === 1);
    if (h1s.length > 1) {
      failures.push({
        pageId: p.id,
        pageUrl: p.url,
        detail: `${h1s.length} H1 headings found`,
        evidence: { headings: h1s.map((h) => h.text).slice(0, 4) },
      });
    }
  }
  return outcome(
    {
      code: "T009",
      category: "technical",
      severity: "medium",
      title: "Multiple H1 headings",
      whyItMatters: "Several H1s blur the page's primary topic.",
      recommendation: "Keep a single H1 and demote secondary headings to H2/H3.",
      weight: 4,
    },
    indexable(ctx).length,
    failures
  );
};

export const headingHierarchy: Check = (ctx) => {
  const failures: CheckOutcome["failures"] = [];
  for (const p of indexable(ctx)) {
    const hs = safeHeadings(p);
    for (let i = 1; i < hs.length; i++) {
      if (hs[i].level > hs[i - 1].level + 1) {
        failures.push({
          pageId: p.id,
          pageUrl: p.url,
          detail: `Heading jumps from H${hs[i - 1].level} to H${hs[i].level}`,
        });
        break;
      }
    }
  }
  return outcome(
    {
      code: "T010",
      category: "technical",
      severity: "low",
      title: "Heading hierarchy skips levels",
      whyItMatters: "Skipped levels weaken the document outline that engines parse for structure.",
      recommendation: "Nest headings sequentially (H2 → H3 → H4) without skipping levels.",
      weight: 2,
    },
    indexable(ctx).length,
    failures
  );
};

export const canonicalIssues: Check = (ctx) => {
  const failures: CheckOutcome["failures"] = [];
  for (const p of ctx.pages) {
    if (!p.canonical) {
      if (p.is_indexable === 1) {
        failures.push({ pageId: p.id, pageUrl: p.url, detail: "No canonical tag" });
      }
      continue;
    }
    try {
      const canon = new URL(p.canonical, ctx.website.url);
      const self = new URL(p.url);
      if (canon.origin !== self.origin) {
        failures.push({
          pageId: p.id,
          pageUrl: p.url,
          detail: `Canonical points to another domain: ${canon.origin}`,
        });
      } else if (canon.pathname.replace(/\/$/, "") !== self.pathname.replace(/\/$/, "")) {
        failures.push({
          pageId: p.id,
          pageUrl: p.url,
          detail: `Canonical points elsewhere: ${canon.pathname}`,
        });
      }
    } catch {
      failures.push({ pageId: p.id, pageUrl: p.url, detail: "Canonical is not a valid URL" });
    }
  }
  return outcome(
    {
      code: "T013",
      category: "technical",
      severity: "medium",
      title: "Canonical tag issues",
      whyItMatters: "Incorrect canonicals can consolidate signals to the wrong URL or split them.",
      recommendation: "Self-canonicalize each indexable page, or point duplicates at their preferred URL.",
      weight: 6,
    },
    ctx.pages.filter((p) => p.is_indexable === 1).length,
    failures
  );
};

export const noindex: Check = (ctx) => {
  const failures = ctx.pages
    .filter((p) => p.is_indexable === 0)
    .map((p) => ({ pageId: p.id, pageUrl: p.url, detail: "Page is noindex" }));
  return outcome(
    {
      code: "T015",
      category: "technical",
      severity: "low",
      title: "Pages blocked from indexing",
      whyItMatters: "noindex pages receive no search visibility — correct only when intentional.",
      recommendation: "Confirm each noindex page is meant to be excluded; remove the tag otherwise.",
      weight: 3,
    },
    ctx.pages.length,
    failures
  );
};

export const httpsIssues: Check = (ctx) => {
  const failures =
    ctx.website.url.startsWith("http://") && !ctx.website.url.startsWith("https://")
      ? [{ detail: "Website is served over HTTP instead of HTTPS" }]
      : [];
  return outcome(
    {
      code: "T016",
      category: "technical",
      severity: "high",
      title: "Site not served over HTTPS",
      whyItMatters: "HTTPS is a baseline trust and ranking signal; browsers flag HTTP pages as insecure.",
      recommendation: "Install a TLS certificate and redirect all HTTP traffic to HTTPS.",
      weight: 8,
    },
    1,
    failures
  );
};

export const robotsSitemap: Check = (ctx) => {
  const failures: CheckOutcome["failures"] = [];
  if (!ctx.robotsPresent) failures.push({ detail: "robots.txt not found" });
  if (!ctx.sitemapPresent) failures.push({ detail: "No sitemap discovered" });
  return outcome(
    {
      code: "T017",
      category: "technical",
      severity: "medium",
      title: "Missing robots.txt or XML sitemap",
      whyItMatters: "Crawlers rely on robots.txt for directives and sitemaps for complete URL discovery.",
      recommendation: "Publish a robots.txt referencing an XML sitemap that lists all indexable pages.",
      weight: 5,
    },
    1,
    failures
  );
};

export const imagesMissingAlt: Check = (ctx) => {
  const failures = ctx.pages
    .filter((p) => p.images_missing_alt > 0)
    .map((p) => ({
      pageId: p.id,
      pageUrl: p.url,
      detail: `${p.images_missing_alt} of ${p.image_count} images missing alt text`,
    }));
  return outcome(
    {
      code: "T019",
      category: "technical",
      severity: "medium",
      title: "Images missing alt text",
      whyItMatters: "Alt text makes images accessible and understandable to image and answer engines.",
      recommendation: "Add descriptive alt text to informative images (empty alt for decorative ones).",
      weight: 5,
    },
    ctx.pages.filter((p) => p.image_count > 0).length,
    failures
  );
};

export const slowPages: Check = (ctx) => {
  const failures: CheckOutcome["failures"] = [];
  for (const p of ctx.pages) {
    if (p.ttfb_ms >= VERY_SLOW_MS) {
      failures.push({ pageId: p.id, pageUrl: p.url, detail: `Server response ${p.ttfb_ms}ms` });
    } else if (p.ttfb_ms >= SLOW_MS) {
      failures.push({ pageId: p.id, pageUrl: p.url, detail: `Server response ${p.ttfb_ms}ms` });
    }
  }
  return outcome(
    {
      code: "P001",
      category: "performance",
      severity: "medium",
      title: "Slow server response times",
      whyItMatters: "Slow responses harm user experience and crawl efficiency.",
      recommendation: "Profile the origin (caching, CDN, database) to bring responses under 1.5s.",
      weight: 6,
    },
    ctx.pages.length,
    failures
  );
};

export const largeHtml: Check = (ctx) => {
  const failures = ctx.pages
    .filter((p) => p.html_bytes > LARGE_HTML)
    .map((p) => ({
      pageId: p.id,
      pageUrl: p.url,
      detail: `${Math.round(p.html_bytes / 1024)}KB HTML`,
    }));
  return outcome(
    {
      code: "P002",
      category: "performance",
      severity: "low",
      title: "Oversized HTML documents",
      whyItMatters: "Large payloads slow first paint and waste crawl budget.",
      recommendation: "Trim inline scripts/styles and paginate or lazy-load heavy sections.",
      weight: 3,
    },
    ctx.pages.length,
    failures
  );
};

export const missingLang: Check = (ctx) => {
  const failures = ctx.pages
    .filter((p) => !p.lang)
    .map((p) => ({ pageId: p.id, pageUrl: p.url, detail: "<html> has no lang attribute" }));
  return outcome(
    {
      code: "T020",
      category: "technical",
      severity: "low",
      title: "Missing language attribute",
      whyItMatters: "Language declarations help engines serve the right page to the right audience.",
      recommendation: 'Set <html lang="en"> (or the correct language) on every page.',
      weight: 2,
    },
    ctx.pages.length,
    failures
  );
};

export const deepPages: Check = (ctx) => {
  const failures = indexable(ctx)
    .filter((p) => p.depth > MAX_DEPTH)
    .map((p) => ({ pageId: p.id, pageUrl: p.url, detail: `Depth ${p.depth} (max recommended ${MAX_DEPTH})` }));
  return outcome(
    {
      code: "T024",
      category: "technical",
      severity: "low",
      title: "Deeply nested pages",
      whyItMatters: "Pages far from the homepage accrue fewer internal links and crawl attention.",
      recommendation: "Link important pages from top-level navigation or category pages.",
      weight: 3,
    },
    indexable(ctx).length,
    failures
  );
};

export const orphanPages: Check = (ctx) => {
  const failures = indexable(ctx)
    .filter((p) => (ctx.inboundLinks.get(p.id) ?? 0) === 0 && ctx.pages.length > 1)
    .map((p) => ({ pageId: p.id, pageUrl: p.url, detail: "No internal links pointing to this page" }));
  return outcome(
    {
      code: "T023",
      category: "technical",
      severity: "medium",
      title: "Orphan pages",
      whyItMatters: "Unlinked pages are hard to discover and pass no internal authority.",
      recommendation: "Add contextual internal links to these pages from relevant existing content.",
      weight: 6,
    },
    indexable(ctx).length,
    failures
  );
};

export const brokenInternalLinks: Check = (ctx) => {
  const failures = ctx.brokenInternalUrls.map((b) => ({
    pageUrl: b.from,
    detail: `Link to ${b.url} returned ${b.status}`,
    evidence: { url: b.url, status: b.status },
  }));
  return outcome(
    {
      code: "T011",
      category: "technical",
      severity: "high",
      title: "Broken internal links",
      whyItMatters: "Broken links waste crawl paths and create dead ends for visitors.",
      recommendation: "Fix the target URL or remove/update the link.",
      weight: 7,
    },
    ctx.pages.length,
    failures
  );
};

export const redirectingPages: Check = (ctx) => {
  const failures = ctx.pages
    .filter((p) => p.redirect_url)
    .map((p) => ({
      pageId: p.id,
      pageUrl: p.url,
      detail: `Redirects to ${p.redirect_url}`,
    }));
  return outcome(
    {
      code: "T012",
      category: "technical",
      severity: "medium",
      title: "Redirected URLs in the crawl",
      whyItMatters: "Redirect hops add latency and dilute link signals.",
      recommendation: "Update internal links and sitemap entries to point directly at the final URL.",
      weight: 4,
    },
    ctx.pages.length,
    failures
  );
};

export const errorPages: Check = (ctx) => {
  const failures = ctx.pages
    .filter((p) => (p.status_code ?? 200) >= 400)
    .map((p) => ({
      pageId: p.id,
      pageUrl: p.url,
      detail: `HTTP ${p.status_code}`,
      evidence: { status: p.status_code },
    }));
  return outcome(
    {
      code: "T025",
      category: "technical",
      severity: "high",
      title: "Error pages discovered during crawl",
      whyItMatters: "4xx/5xx responses block users and waste crawl activity.",
      recommendation: "Restore the content, fix the link, or implement a proper 410/redirect.",
      weight: 7,
    },
    ctx.pages.length,
    failures
  );
};

// ---------------- on-page ----------------

export const thinContent: Check = (ctx) => {
  const failures = indexable(ctx)
    .filter((p) => p.word_count < THIN_WORDS)
    .map((p) => ({
      pageId: p.id,
      pageUrl: p.url,
      detail: `${p.word_count} words (under ${THIN_WORDS})`,
    }));
  return outcome(
    {
      code: "O001",
      category: "onpage",
      severity: "medium",
      title: "Thin content pages",
      whyItMatters: "Pages with little substantive text rarely satisfy a searcher's full intent.",
      recommendation: "Expand the page with useful, specific content that answers the query fully.",
      weight: 7,
    },
    indexable(ctx).length,
    failures
  );
};

export const keywordInTitle: Check = (ctx) => {
  const keywords = keywordsOf(ctx);
  if (keywords.length === 0) {
    return outcome(
      {
        code: "O002",
        category: "onpage",
        severity: "medium",
        title: "Primary keywords missing from titles",
        whyItMatters: "Titles carrying the target topic help engines match pages to queries.",
        recommendation: "Add the page's primary keyword naturally to the title.",
        weight: 6,
      },
      0,
      []
    );
  }
  const failures: CheckOutcome["failures"] = [];
  let applicable = 0;
  for (const p of indexable(ctx)) {
    applicable++;
    const haystack = `${p.title ?? ""} ${p.h1 ?? ""}`.toLowerCase();
    if (!keywords.some((k) => haystack.includes(k))) {
      failures.push({
        pageId: p.id,
        pageUrl: p.url,
        detail: `None of your primary keywords appear in the title or H1`,
        evidence: { keywords },
      });
    }
  }
  return outcome(
    {
      code: "O002",
      category: "onpage",
      severity: "medium",
      title: "Primary keywords missing from titles",
      whyItMatters: "Titles carrying the target topic help engines match pages to queries.",
      recommendation: "Add the page's primary keyword naturally to the title and H1.",
      weight: 6,
    },
    applicable,
    failures
  );
};

export const missingOutboundRefs: Check = (ctx) => {
  const failures = indexable(ctx)
    .filter((p) => p.external_link_count === 0 && p.word_count >= THIN_WORDS)
    .map((p) => ({ pageId: p.id, pageUrl: p.url, detail: "No external references" }));
  return outcome(
    {
      code: "G004",
      category: "geo",
      severity: "low",
      title: "Content without external references",
      whyItMatters: "Citing credible sources makes claims verifiable — a factor answer engines weigh.",
      recommendation: "Link to 1–3 authoritative sources that support key claims.",
      weight: 3,
    },
    indexable(ctx).filter((p) => p.word_count >= THIN_WORDS).length,
    failures
  );
};

export const missingStructuredData: Check = (ctx) => {
  const failures = indexable(ctx)
    .filter((p) => p.has_structured_data === 0)
    .map((p) => ({ pageId: p.id, pageUrl: p.url, detail: "No JSON-LD structured data" }));
  return outcome(
    {
      code: "G002",
      category: "geo",
      severity: "medium",
      title: "Pages without structured data",
      whyItMatters: "Structured data makes entities, products and answers machine-readable and eligible for rich results.",
      recommendation: "Add accurate JSON-LD (Article, FAQPage, Product, BreadcrumbList as applicable).",
      weight: 6,
    },
    indexable(ctx).length,
    failures
  );
};

export const missingOrgSchema: Check = (ctx) => {
  const hasOrg = ctx.pages.some(
    (p) => p.has_structured_data === 1 && p.structured_types.toLowerCase().includes("organization")
  );
  const failures = hasOrg ? [] : [{ detail: "No Organization schema found on any crawled page" }];
  return outcome(
    {
      code: "G001",
      category: "geo",
      severity: "medium",
      title: "Missing Organization entity markup",
      whyItMatters: "An Organization entity helps search and AI systems identify and describe your brand consistently.",
      recommendation: "Add an Organization JSON-LD with name, logo, url and sameAs profiles (usually on the homepage).",
      weight: 6,
    },
    1,
    failures
  );
};

export const missingSocialMeta: Check = (ctx) => {
  const failures = indexable(ctx)
    .filter((p) => !p.og_title || !p.og_description)
    .map((p) => ({ pageId: p.id, pageUrl: p.url, detail: "Missing Open Graph tags" }));
  return outcome(
    {
      code: "G003",
      category: "geo",
      severity: "low",
      title: "Missing Open Graph metadata",
      whyItMatters: "OG tags control how your pages appear when shared on social platforms and in AI previews.",
      recommendation: "Add og:title and og:description matching the page's content.",
      weight: 3,
    },
    indexable(ctx).length,
    failures
  );
};

export const missingFaqBlock: Check = (ctx) => {
  const failures = indexable(ctx)
    .filter((p) => !hasQuestionContent(p))
    .map((p) => ({ pageId: p.id, pageUrl: p.url, detail: "No questions or FAQ content detected" }));
  return outcome(
    {
      code: "A001",
      category: "aeo",
      severity: "medium",
      title: "Pages without question/FAQ content",
      whyItMatters: "Answer engines favor pages that address real user questions directly.",
      recommendation: "Add an FAQ section answering 3–5 genuine questions with concise, factual answers.",
      weight: 6,
    },
    indexable(ctx).length,
    failures
  );
};

export const faqSchemaGap: Check = (ctx) => {
  const failures = indexable(ctx)
    .filter((p) => hasQuestionContent(p) && !p.structured_types.toLowerCase().includes("faqpage"))
    .map((p) => ({ pageId: p.id, pageUrl: p.url, detail: "Questions present but no FAQPage schema" }));
  return outcome(
    {
      code: "A002",
      category: "aeo",
      severity: "low",
      title: "FAQ content without FAQPage schema",
      whyItMatters: "FAQPage markup makes your Q&A machine-readable for answer engines.",
      recommendation: "Generate matching FAQPage JSON-LD from the existing questions.",
      weight: 4,
    },
    indexable(ctx).filter(hasQuestionContent).length,
    failures
  );
};

function hasQuestionContent(p: PageLite): boolean {
  if (/\?/.test(p.text_sample) && /\b(how|what|why|when|where|which|who|can|is|does|should)\b/i.test(p.text_sample)) {
    return true;
  }
  try {
    const hs = JSON.parse(p.headings) as Array<{ text: string }>;
    return hs.some((h) => h.text.trim().endsWith("?"));
  } catch {
    return false;
  }
}

export function keywordsOf(ctx: CheckContext): string[] {
  return (ctx.website.primary_keywords ?? "")
    .split(/[,;\n]/)
    .map((k) => k.trim().toLowerCase())
    .filter((k) => k.length >= 2);
}

function safeHeadings(p: PageLite): Array<{ level: number; text: string }> {
  try {
    const parsed = JSON.parse(p.headings) as Array<{ level: number; text: string }>;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export const TECHNICAL_CHECKS: Check[] = [
  missingTitle,
  shortLongTitle,
  duplicateTitles,
  missingMeta,
  duplicateMeta,
  metaLength,
  missingH1,
  multipleH1,
  headingHierarchy,
  canonicalIssues,
  noindex,
  httpsIssues,
  robotsSitemap,
  imagesMissingAlt,
  missingLang,
  deepPages,
  orphanPages,
  brokenInternalLinks,
  redirectingPages,
  errorPages,
];

export const ONPAGE_CHECKS: Check[] = [thinContent, keywordInTitle];

export const CONTENT_CHECKS: Check[] = [];

export const AEO_CHECKS: Check[] = [missingFaqBlock, faqSchemaGap];

export const GEO_CHECKS: Check[] = [missingOrgSchema, missingStructuredData, missingSocialMeta, missingOutboundRefs];

export const PERFORMANCE_CHECKS: Check[] = [slowPages, largeHtml];

export const ALL_CHECKS: Check[] = [
  ...TECHNICAL_CHECKS,
  ...ONPAGE_CHECKS,
  ...CONTENT_CHECKS,
  ...AEO_CHECKS,
  ...GEO_CHECKS,
  ...PERFORMANCE_CHECKS,
];

export { countWords };
