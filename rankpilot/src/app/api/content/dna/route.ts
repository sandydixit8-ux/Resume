import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/get-session";
import { err, ok } from "@/lib/http";
import { all, row } from "@/lib/db/db";
import { getWebsite } from "@/lib/websites/repo";

/**
 * Content DNA: observed structural fingerprint of a website's content.
 * Everything here is computed from crawled pages — no estimates.
 */
export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  const websiteId = req.nextUrl.searchParams.get("websiteId");
  if (!websiteId) return err.validation("websiteId required");
  if (!getWebsite(s.org.id, websiteId)) return err.notFound();

  const stats = row<{
    pages: number;
    avgWords: number | null;
    avgTitleLen: number | null;
    avgMetaLen: number | null;
    pagesWithFaq: number;
    pagesWithSchema: number;
    missingAlt: number;
    images: number;
  }>(
    `SELECT COUNT(*) AS pages,
            AVG(word_count) AS avgWords,
            AVG(title_len) AS avgTitleLen,
            AVG(meta_desc_len) AS avgMetaLen,
            SUM(CASE WHEN structured_types LIKE '%FAQ%' THEN 1 ELSE 0 END) AS pagesWithFaq,
            SUM(CASE WHEN has_structured_data = 1 THEN 1 ELSE 0 END) AS pagesWithSchema,
            SUM(images_missing_alt) AS missingAlt,
            SUM(image_count) AS images
     FROM pages WHERE website_id = ? AND tenant_id = ?`,
    websiteId,
    s.org.id
  );

  const headings = all<{ headings: string }>(
    "SELECT headings FROM pages WHERE website_id = ? AND tenant_id = ? LIMIT 100",
    websiteId,
    s.org.id
  );
  const depthCount: Record<string, number> = {};
  for (const h of headings) {
    try {
      for (const item of JSON.parse(h.headings || "[]") as Array<{ level?: number }>) {
        const k = `h${item.level ?? 0}`;
        depthCount[k] = (depthCount[k] ?? 0) + 1;
      }
    } catch {
      // unparsable headings are skipped, not guessed
    }
  }

  return ok({
    stats: {
      pages: stats?.pages ?? 0,
      avgWordCount: stats?.avgWords ?? null,
      avgTitleLength: stats?.avgTitleLen ?? null,
      avgMetaDescriptionLength: stats?.avgMetaLen ?? null,
      pagesWithFaqSchema: stats?.pagesWithFaq ?? 0,
      pagesWithStructuredData: stats?.pagesWithSchema ?? 0,
      imageAltCoverage:
        stats && stats.images ? Number(((1 - (stats.missingAlt ?? 0) / stats.images) * 100).toFixed(1)) : null,
    },
    headingDepth: depthCount,
    note: "All values derive from crawled pages. Null means not observed.",
  });
}
