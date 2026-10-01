import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { err, ok } from "@/lib/http";
import { getWebsite } from "@/lib/websites/repo";
import { all, row } from "@/lib/db/db";

const querySchema = z.object({
  websiteId: z.string().min(1),
  severity: z.enum(["critical", "high", "medium", "low"]).optional(),
  category: z.enum(["technical", "onpage", "content", "aeo", "geo", "performance"]).optional(),
  status: z.enum(["new", "in_progress", "resolved", "ignored"]).optional(),
  q: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return err.validation(parsed.error.issues);
  const q = parsed.data;

  if (!getWebsite(s.org.id, q.websiteId)) return err.notFound();

  const where: string[] = ["i.website_id = ?", "i.tenant_id = ?"];
  const params: Array<string | number> = [q.websiteId, s.org.id];
  if (q.severity) {
    where.push("i.severity = ?");
    params.push(q.severity);
  }
  if (q.category) {
    where.push("i.category = ?");
    params.push(q.category);
  }
  if (q.status) {
    where.push("i.status = ?");
    params.push(q.status);
  } else {
    where.push("i.status != 'resolved'");
  }
  if (q.q) {
    where.push("(i.title LIKE ? OR i.recommendation LIKE ?)");
    params.push(`%${q.q}%`, `%${q.q}%`);
  }

  const whereSql = where.join(" AND ");
  const total =
    row<{ n: number }>(`SELECT COUNT(*) AS n FROM seo_issues i WHERE ${whereSql}`, ...params)?.n ?? 0;

  const items = all(
    `SELECT i.id, i.code, i.category, i.severity, i.title, i.description, i.why_it_matters,
            i.recommendation, i.evidence, i.status, i.first_seen_at, i.last_seen_at,
            i.page_id, p.url AS page_url, p.title AS page_title
     FROM seo_issues i
     LEFT JOIN pages p ON p.id = i.page_id
     WHERE ${whereSql}
     ORDER BY CASE i.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
              i.created_at DESC
     LIMIT ? OFFSET ?`,
    ...params,
    q.limit,
    q.offset
  );

  const counts = all<{ severity: string; n: number }>(
    `SELECT severity, COUNT(*) AS n FROM seo_issues i WHERE ${whereSql} GROUP BY severity`,
    ...params
  );

  return ok({
    items: items.map((i) => ({
      ...i,
      evidence: JSON.parse(String(i.evidence ?? "{}")),
    })),
    total,
    counts: Object.fromEntries(counts.map((c) => [c.severity, c.n])),
  });
}
