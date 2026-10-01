import { describe, expect, it } from "vitest";
import {
  missingTitle,
  shortLongTitle,
  duplicateTitles,
  missingMeta,
  metaLength,
  missingH1,
  robotsSitemap,
  thinContent,
} from "@/lib/seo/checks";
import type { CheckContext, PageLite } from "@/lib/seo/types";

function makePage(over: Partial<PageLite> = {}): PageLite {
  return {
    id: "pg_1",
    url: "https://example.com/",
    url_key: "https://example.com",
    status_code: 200,
    redirect_url: null,
    content_type: "text/html",
    depth: 0,
    title: "A perfectly reasonable page title here",
    title_len: 39,
    meta_description: "A".repeat(90),
    meta_desc_len: 90,
    h1: "Welcome",
    headings: JSON.stringify([{ level: 1, text: "Welcome" }]),
    canonical: "https://example.com/",
    robots_meta: null,
    is_indexable: 1,
    word_count: 800,
    lang: "en",
    internal_link_count: 3,
    external_link_count: 1,
    inbound_link_count: 1,
    image_count: 2,
    images_missing_alt: 0,
    html_bytes: 40_000,
    ttfb_ms: 250,
    has_structured_data: 0,
    structured_types: "[]",
    og_title: null,
    og_description: null,
    text_sample: "sample text",
    ...over,
  };
}

function makeCtx(pages: PageLite[], over: Partial<CheckContext> = {}): CheckContext {
  return {
    website: { id: "ws_1", url: "https://example.com", normalized_url: "https://example.com", primary_keywords: null },
    pages,
    robotsPresent: true,
    sitemapPresent: true,
    inboundLinks: new Map(pages.map((p) => [p.id, p.inbound_link_count])),
    sameSiteUrlKeys: new Set(pages.map((p) => p.url_key)),
    brokenInternalUrls: [],
    ...over,
  };
}

describe("technical checks", () => {
  it("flags pages without a title and passes ones with a title", () => {
    const bad = missingTitle(makeCtx([makePage({ title: null, title_len: 0 })]));
    expect(bad.failures).toHaveLength(1);
    expect(bad.applicable).toBe(1);

    const good = missingTitle(makeCtx([makePage()]));
    expect(good.failures).toHaveLength(0);
  });

  it("flags titles outside the 15–60 character range", () => {
    const short = shortLongTitle(makeCtx([makePage({ title: "Too short", title_len: 9 })]));
    expect(short.failures).toHaveLength(1);

    const long = shortLongTitle(
      makeCtx([makePage({ title: "x".repeat(80), title_len: 80 })])
    );
    expect(long.failures).toHaveLength(1);

    const ok = shortLongTitle(makeCtx([makePage()]));
    expect(ok.failures).toHaveLength(0);
  });

  it("flags duplicate titles across pages", () => {
    const ctx = makeCtx([
      makePage({ id: "pg_1", url_key: "https://example.com/a", url: "https://example.com/a" }),
      makePage({ id: "pg_2", url_key: "https://example.com/b", url: "https://example.com/b" }),
    ]);
    const dup = duplicateTitles(ctx);
    expect(dup.applicable).toBe(2);
    expect(dup.failures).toHaveLength(1);
    expect(dup.failures[0].evidence?.urls).toHaveLength(2);
  });

  it("flags missing meta descriptions and bad meta lengths", () => {
    const missing = missingMeta(makeCtx([makePage({ meta_description: null, meta_desc_len: 0 })]));
    expect(missing.failures).toHaveLength(1);

    const tooShort = metaLength(
      makeCtx([makePage({ meta_description: "short", meta_desc_len: 5 })])
    );
    expect(tooShort.failures).toHaveLength(1);

    const goodMeta = metaLength(makeCtx([makePage()]));
    expect(goodMeta.failures).toHaveLength(0);
  });

  it("flags pages without an H1", () => {
    const missing = missingH1(makeCtx([makePage({ h1: null, headings: "[]" })]));
    expect(missing.failures).toHaveLength(1);

    const ok = missingH1(makeCtx([makePage()]));
    expect(ok.failures).toHaveLength(0);
  });

  it("flags a site with no robots.txt or sitemap", () => {
    const ctx = makeCtx([makePage()], { robotsPresent: false, sitemapPresent: false });
    expect(robotsSitemap(ctx).failures).toHaveLength(2);
    const sitemapOnly = makeCtx([makePage()], { robotsPresent: true, sitemapPresent: false });
    expect(robotsSitemap(sitemapOnly).failures).toHaveLength(1);
    expect(robotsSitemap(makeCtx([makePage()])).failures).toHaveLength(0);
  });
});

describe("on-page checks", () => {
  it("flags thin pages under 300 words and passes deeper ones", () => {
    expect(thinContent(makeCtx([makePage({ word_count: 120 })])).failures).toHaveLength(1);
    expect(thinContent(makeCtx([makePage()])).failures).toHaveLength(0);
  });

  it("ignores non-indexable and error pages", () => {
    const ctx = makeCtx([makePage({ is_indexable: 0 })]);
    expect(missingH1(ctx).applicable).toBe(0);
    expect(thinContent(ctx).applicable).toBe(0);
  });
});
