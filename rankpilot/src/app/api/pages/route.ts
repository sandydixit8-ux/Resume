import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { err, ok } from "@/lib/http";
import { getWebsite } from "@/lib/websites/repo";
import { all, row } from "@/lib/db/db";

const querySchema = z.object({
  websiteId: z.string().min(1),
  q: z.string().max(200).optional(),
  indexable: z.enum(["1", "0"]).optional(),
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

  const where = ["website_id = ?", "tenant_id = ?"];
  const params: Array<string | number> = [q.websiteId, s.org.id];
  if (q.q) {
    where.push("(url LIKE ? OR title LIKE ?)");
    params.push(`%${q.q}%`, `%${q.q}%`);
  }
  if (q.indexable) {
    where.push("is_indexable = ?");
    params.push(Number(q.indexable));
  }
  const whereSql = where.join(" AND ");

  const total = row<{ n: number }>(`SELECT COUNT(*) AS n FROM pages WHERE ${whereSql}`, ...params)?.n ?? 0;
  const items = all(
    `SELECT id, url, status_code, title, meta_description, h1, word_count, depth, is_indexable,
            image_count, images_missing_alt, internal_link_count, inbound_link_count,
            has_structured_data, ttfb_ms, run_id, fetched_at
     FROM pages WHERE ${whereSql}
     ORDER BY (status_code >= 400) DESC, depth ASC, url ASC
     LIMIT ? OFFSET ?`,
    ...params,
    q.limit,
    q.offset
  );

  return ok({ items, total });
}
