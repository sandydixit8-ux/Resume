export interface Heading {
  level: number;
  text: string;
}

export interface PageFacts {
  title: string | null;
  titleLen: number;
  metaDescription: string | null;
  metaDescLen: number;
  h1: string | null;
  h1Count: number;
  headings: Heading[];
  canonical: string | null;
  robotsMeta: string | null;
  isIndexable: boolean;
  lang: string | null;
  linkHrefs: string[];
  imageCount: number;
  imagesMissingAlt: number;
  textSample: string;
  wordCount: number;
  hasStructuredData: boolean;
  structuredTypes: string[];
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  htmlBytes: number;
  hasNofollowRobots: boolean;
}

const MAX_TEXT_SAMPLE = 4000;
/** Heading count kept per page. See the loop in parseHtml for why it is capped. */
const MAX_HEADINGS = 200;

export function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

export function stripTags(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim();
}

function metaContent(html: string, name: string): string | null {
  const patterns = [
    new RegExp(
      `<meta[^>]*name=["']${name}["'][^>]*content=["']([^"']*)["'][^>]*>`,
      "i"
    ),
    new RegExp(
      `<meta[^>]*content=["']([^"']*)["'][^>]*name=["']${name}["'][^>]*>`,
      "i"
    ),
  ];
  for (const re of patterns) {
    const m = re.exec(html);
    if (m) return decodeEntities(m[1].trim());
  }
  return null;
}

function ogContent(html: string, prop: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]*property=["']${prop}["'][^>]*content=["']([^"']*)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*property=["']${prop}["'][^>]*>`, "i"),
  ];
  for (const re of patterns) {
    const m = re.exec(html);
    if (m) return decodeEntities(m[1].trim());
  }
  return null;
}

export function countWords(text: string): number {
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
}

/** Deterministic HTML fact extraction (no external dependencies). */
export function parseHtml(html: string): PageFacts {
  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  const title = titleMatch ? stripTags(titleMatch[1]) : null;

  const metaDescription = metaContent(html, "description");
  const robotsMeta = metaContent(html, "robots");
  const lang = /<html[^>]*\slang=["']([^"']+)["']/i.exec(html)?.[1] ?? null;

  const h1Matches = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)];
  const h1 = h1Matches.length ? stripTags(h1Matches[0][1]) : null;

  const headings: Heading[] = [];
  for (const m of html.matchAll(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi)) {
    // Real pages have a few dozen headings. Without a count cap, a page that
    // is nothing but thousands of <h3> tags stores megabytes of JSON, bloats
    // every AI prompt built from it, and gets re-scanned once per keyword.
    if (headings.length >= MAX_HEADINGS) break;
    const text = stripTags(m[2]);
    if (text) headings.push({ level: Number(m[1]), text: text.slice(0, 300) });
  }

  const canonical =
    /<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i.exec(html)?.[1] ??
    /<link[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical["']/i.exec(html)?.[1] ??
    null;

  const linkHrefs: string[] = [];
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi)) {
    linkHrefs.push(decodeEntities(m[1]));
  }

  let imageCount = 0;
  let imagesMissingAlt = 0;
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    imageCount++;
    const alt = /\salt=["']([^"']*)["']/i.exec(m[0])?.[1];
    if (alt === undefined || alt.trim() === "") imagesMissingAlt++;
  }

  const structuredTypes: string[] = [];
  for (const m of html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  )) {
    try {
      const parsed = JSON.parse(m[1].trim()) as unknown;
      collectSchemaTypes(parsed, structuredTypes);
    } catch {
      structuredTypes.push("InvalidJSONLD");
    }
  }

  const bodyMatch = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(html);
  const text = stripTags(bodyMatch ? bodyMatch[1] : html);
  const wordCount = countWords(text);

  const robotsLower = (robotsMeta ?? "").toLowerCase();
  const isIndexable = !robotsLower.includes("noindex");
  const hasNofollowRobots = robotsLower.includes("nofollow");

  return {
    title,
    titleLen: title?.length ?? 0,
    metaDescription,
    metaDescLen: metaDescription?.length ?? 0,
    h1,
    h1Count: h1Matches.length,
    headings,
    canonical: canonical ? decodeEntities(canonical.trim()) : null,
    robotsMeta,
    isIndexable,
    lang,
    linkHrefs,
    imageCount,
    imagesMissingAlt,
    textSample: text.slice(0, MAX_TEXT_SAMPLE),
    wordCount,
    hasStructuredData: structuredTypes.length > 0,
    structuredTypes,
    ogTitle: ogContent(html, "og:title"),
    ogDescription: ogContent(html, "og:description"),
    ogImage: ogContent(html, "og:image"),
    htmlBytes: Buffer.byteLength(html, "utf8"),
    hasNofollowRobots,
  };
}

function collectSchemaTypes(value: unknown, out: string[]): void {
  if (Array.isArray(value)) {
    for (const v of value) collectSchemaTypes(v, out);
    return;
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj["@type"] === "string") out.push(obj["@type"]);
    else if (Array.isArray(obj["@type"])) {
      for (const t of obj["@type"]) if (typeof t === "string") out.push(t);
    }
    for (const v of Object.values(obj)) {
      if (v && typeof v === "object") collectSchemaTypes(v, out);
    }
  }
}
