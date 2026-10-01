import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { err, ok } from "@/lib/http";
import { all, newId, nowIso, row, run } from "@/lib/db/db";
import { getWebsite } from "@/lib/websites/repo";

/**
 * Deterministic internal-link suggestions (rules-first, no AI key needed).
 * Only pairs where the source page text already mentions the target's topic
 * but has no link — grounded in crawled data only.
 */
const query = z.object({ websiteId: z.string().min(1), regenerate: z.enum(["0", "1"]).default("0") });

interface Pg {
  id: string;
  url: string;
  title: string | null;
  h1: string | null;
  word_count: number;
  text_sample: string | null;
  internal_link_count: number;
}

export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  const parsed = query.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return err.validation(parsed.error.issues);
  const { websiteId, regenerate } = parsed.data;
  if (!getWebsite(s.org.id, websiteId)) return err.notFound();

  const existing = all(
    `SELECT id, source_page_id, target_page_id, anchor_text, reason, priority, status, created_at
     FROM internal_links WHERE website_id = ? AND tenant_id = ? ORDER BY created_at DESC LIMIT 100`,
    websiteId,
    s.org.id
  );

  if (regenerate === "1" && existing.length === 0) {
    suggestLinks(websiteId, s.org.id);
    return ok({
      items: all(
        `SELECT id, source_page_id, target_page_id, anchor_text, reason, priority, status, created_at
         FROM internal_links WHERE website_id = ? AND tenant_id = ? ORDER BY created_at DESC LIMIT 100`,
        websiteId,
        s.org.id
      ),
      source: "rules",
    });
  }

  return ok({ items: existing, source: "rules" });
}

function suggestLinks(websiteId: string, tenantId: string): number {
  const pages = all<Pg>(
    `SELECT id, url, title, h1, word_count, text_sample, internal_link_count
     FROM pages WHERE website_id = ? AND tenant_id = ?
     ORDER BY word_count DESC LIMIT 50`,
    websiteId,
    tenantId
  );
  if (pages.length < 2) return 0;

  let created = 0;
  const now = nowIso();
  for (const source of pages) {
    const text = `${source.text_sample ?? ""} ${source.title ?? ""} ${source.h1 ?? ""}`.toLowerCase();
    if (!text.trim()) continue;
    for (const target of pages) {
      if (target.id === source.id) continue;
      const anchor = (target.h1 || target.title || "").trim();
      if (!anchor) continue;
      const anchorKey = anchor.toLowerCase().slice(0, 40);
      if (!text.includes(anchorKey)) continue; // must be mentioned in source text

      const already = row<{ id: string }>(
        "SELECT id FROM internal_links WHERE website_id = ? AND source_page_id = ? AND target_page_id = ?",
        websiteId,
        source.id,
        target.id
      );
      if (already) continue;

      run(
        `INSERT INTO internal_links (id, tenant_id, website_id, source_page_id, target_page_id, anchor_text, reason, priority, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'medium', 'suggested', ?)`,
        newId("lnk"),
        tenantId,
        websiteId,
        source.id,
        target.id,
        anchor.slice(0, 120),
        `"${anchor.slice(0, 60)}" appears in this page's text but is not linked — connect them.`,
        now
      );
      created++;
      if (created >= 30) return created;
    }
  }
  return created;
}
