import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { can } from "@/lib/auth/rbac";
import { err, ok } from "@/lib/http";
import { all, newId, nowIso, row, run } from "@/lib/db/db";
import { getWebsite } from "@/lib/websites/repo";
import { audit } from "@/lib/audit";

/**
 * Deterministic schema generator (rules-first, no AI key needed).
 * Builds JSON-LD only from observed page/website data.
 */
const TYPES = ["FAQPage", "Article", "HowTo", "Organization", "BreadcrumbList", "Product"] as const;

const schema = z.object({
  websiteId: z.string().min(1),
  pageId: z.string().optional(),
  type: z.enum(TYPES),
});

interface PageData {
  id: string;
  url: string;
  title: string | null;
  meta_description: string | null;
  h1: string | null;
}

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role, "content:write")) return err.forbidden();
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return err.validation(parsed.error.issues);
  const { websiteId, type } = parsed.data;
  const website = getWebsite(s.org.id, websiteId);
  if (!website) return err.notFound();

  let page: PageData | undefined;
  if (parsed.data.pageId) {
    page = row<PageData>(
      "SELECT id, url, title, meta_description, h1 FROM pages WHERE id = ? AND tenant_id = ?",
      parsed.data.pageId,
      s.org.id
    );
    if (!page) return err.notFound();
  } else {
    page = row<PageData>(
      `SELECT id, url, title, meta_description, h1 FROM pages
       WHERE website_id = ? AND tenant_id = ? ORDER BY depth = 0 DESC LIMIT 1`,
      websiteId,
      s.org.id
    );
  }

  const siteName = String((website as { name?: string }).name ?? "Website");
  const siteUrl = String((website as { url?: string }).url ?? "");
  const jsonLd = buildJsonLd(type, siteName, siteUrl, page);
  const id = newId("sch");
  const now = nowIso();

  run(
    `INSERT INTO schema_markup (id, tenant_id, website_id, page_id, schema_type, json_ld, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?)`,
    id,
    s.org.id,
    websiteId,
    page?.id ?? null,
    type,
    JSON.stringify(jsonLd),
    now,
    now
  );

  audit({
    tenantId: s.org.id,
    userId: s.user.id,
    action: "schema.generate",
    entity: "schema_markup",
    entityId: id,
    meta: { websiteId, pageId: page?.id ?? null, type, source: "rules" },
  });

  return ok({ id, type, jsonLd, status: "draft", source: "rules" });
}

export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  const websiteId = req.nextUrl.searchParams.get("websiteId");
  if (!websiteId) return err.validation("websiteId required");
  if (!getWebsite(s.org.id, websiteId)) return err.notFound();
  const items = all(
    `SELECT id, page_id, schema_type, json_ld, status, created_at FROM schema_markup
     WHERE website_id = ? AND tenant_id = ? ORDER BY created_at DESC LIMIT 100`,
    websiteId,
    s.org.id
  );
  return ok({ items });
}

function buildJsonLd(type: (typeof TYPES)[number], siteName: string, siteUrl: string, page?: PageData): unknown {
  const pageUrl = page?.url ?? siteUrl;
  switch (type) {
    case "Organization":
      return {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: siteName,
        url: siteUrl,
      };
    case "Article":
      return {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: page?.h1 || page?.title || siteName,
        description: page?.meta_description || undefined,
        mainEntityOfPage: pageUrl,
        publisher: { "@type": "Organization", name: siteName },
      };
    case "BreadcrumbList": {
      const crumbs = pageUrl
        .replace(siteUrl, "")
        .split("/")
        .filter(Boolean);
      return {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: crumbs.map((part, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: decodeURIComponent(part),
          item: `${siteUrl}/${crumbs.slice(0, i + 1).join("/")}`,
        })),
      };
    }
    case "HowTo":
      return {
        "@context": "https://schema.org",
        "@type": "HowTo",
        name: page?.h1 || page?.title || siteName,
        step: [{ "@type": "HowToStep", name: "Step 1", text: page?.meta_description || "Data unavailable" }],
      };
    case "FAQPage":
      return {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: [],
        note: "Add questions from the AEO Questions screen; answers must be approved before publishing.",
      };
    case "Product":
    default:
      return {
        "@context": "https://schema.org",
        "@type": "Product",
        name: page?.h1 || page?.title || siteName,
        description: page?.meta_description || undefined,
        brand: { "@type": "Brand", name: siteName },
      };
  }
}
