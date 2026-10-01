/**
 * JSON-LD (schema.org) structured data.
 *
 * Next.js has no first-class way to emit a `<script type="application/ld+json">`
 * other than dangerouslySetInnerHTML, which this repository's xss-guard forbids
 * outright. Rather than weaken that guard or drop structured data, the escape
 * hatch is explicit and narrow: `serializeJsonLd` is the only value the guard
 * will permit there, and it is required to neutralise the sequences that could
 * break out of a script tag.
 *
 * Never render untrusted HTML through here. This is for schema.org metadata
 * built from our own typed values only.
 */

import { absoluteUrl, siteUrl } from "../site-url";

export interface JsonLdNode {
  "@context": "https://schema.org";
  "@type": string;
  [key: string]: unknown;
}

const NAME = "RankPilot AI";
const DESCRIPTION =
  "Analyze SEO, AEO and GEO opportunities, create high-performing content, grow social reach and continuously improve your digital visibility.";

/** Stable identity for the organisation node, shared by every page that emits it. */
export function organizationJsonLd(): JsonLdNode {
  const site = siteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${site}/#organization`,
    name: NAME,
    url: site,
    description: DESCRIPTION,
  };
}

/** The product itself, linked to the organisation by @id. */
export function softwareApplicationJsonLd(): JsonLdNode {
  const site = siteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "@id": `${site}/#software`,
    name: NAME,
    url: site,
    description: DESCRIPTION,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "USD",
      lowPrice: "0",
      // Published prices. Paid plans are not on sale yet, so this must not
      // claim a paid offer exists.
      offerCount: 1,
    },
    publisher: { "@id": `${site}/#organization` },
  };
}

/** Breadcrumb trail for a public page. */
export function breadcrumbJsonLd(trail: Array<{ name: string; path: string }>): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

/** A single blog post, for Article structured data on the post page. */
export function articleJsonLd(input: {
  title: string;
  description: string;
  date: string;
  author: string;
  slug: string;
}): JsonLdNode {
  const site = siteUrl();
  const url = `${site}/blog/${input.slug}`;
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "@id": `${url}#article`,
    headline: input.title,
    description: input.description,
    datePublished: input.date,
    dateModified: input.date,
    url,
    mainEntityOfPage: { "@id": url },
    author: { "@type": "Person", name: input.author },
    publisher: { "@id": `${site}/#organization` },
    inLanguage: "en",
  };
}

/**
 * Serialise a JSON-LD node for embedding inside a <script> element.
 *
 * The escaping is the whole point of this function:
 *  - `<` becomes <, which removes the literal "</script>" sequence that would
 *    otherwise terminate the tag early and let the remainder of the value be
 *    parsed as markup.
 *  - U+2028/U+2029 are escaped because they are valid in JSON strings but are
 *    line terminators in JavaScript, which historically broke inline scripts.
 */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
