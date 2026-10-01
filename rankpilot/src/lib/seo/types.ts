export type Severity = "critical" | "high" | "medium" | "low";
export type Category = "technical" | "onpage" | "content" | "aeo" | "geo" | "performance";

export interface PageLite {
  id: string;
  url: string;
  url_key: string;
  status_code: number | null;
  redirect_url: string | null;
  content_type: string | null;
  depth: number;
  title: string | null;
  title_len: number;
  meta_description: string | null;
  meta_desc_len: number;
  h1: string | null;
  headings: string;
  canonical: string | null;
  robots_meta: string | null;
  is_indexable: number;
  word_count: number;
  lang: string | null;
  internal_link_count: number;
  external_link_count: number;
  inbound_link_count: number;
  image_count: number;
  images_missing_alt: number;
  html_bytes: number;
  ttfb_ms: number;
  has_structured_data: number;
  structured_types: string;
  og_title: string | null;
  og_description: string | null;
  text_sample: string;
}

export interface WebsiteLite {
  id: string;
  url: string;
  normalized_url: string;
  primary_keywords: string | null;
}

export interface Failure {
  pageId?: string;
  pageUrl?: string;
  detail: string;
  evidence?: Record<string, unknown>;
}

export interface CheckOutcome {
  code: string;
  category: Category;
  severity: Severity;
  title: string;
  whyItMatters: string;
  recommendation: string;
  weight: number;
  applicable: number;
  failures: Failure[];
}

export interface CheckContext {
  website: WebsiteLite;
  pages: PageLite[];
  robotsPresent: boolean;
  sitemapPresent: boolean;
  inboundLinks: Map<string, number>;
  sameSiteUrlKeys: Set<string>;
  brokenInternalUrls: Array<{ url: string; status: number; from: string }>;
}

export type Check = (ctx: CheckContext) => CheckOutcome;
