import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { err, ok } from "@/lib/http";
import { getWebsite } from "@/lib/websites/repo";
import { all, row } from "@/lib/db/db";

const querySchema = z.object({
  websiteId: z.string().min(1),
  priority: z.enum(["high", "medium", "low"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return err.validation(parsed.error.issues);
  const q = parsed.data;
  if (!getWebsite(s.org.id, q.websiteId)) return err.notFound();

  const where = ["website_id = ?", "tenant_id = ?"];
  const params: Array<string | number> = [q.websiteId, s.org.id];
  if (q.priority) {
    where.push("priority = ?");
    params.push(q.priority);
  }
  const whereSql = where.join(" AND ");

  const total = row<{ n: number }>(`SELECT COUNT(*) AS n FROM questions WHERE ${whereSql}`, ...params)?.n ?? 0;
  const items = all(
    `SELECT id, text, intent, priority, recommended_answer, recommended_url, schema_type, page_id, created_at
     FROM questions WHERE ${whereSql}
     ORDER BY CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, created_at DESC
     LIMIT ? OFFSET ?`,
    ...params,
    q.limit,
    q.offset
  );

  return ok({ items, total });
}
