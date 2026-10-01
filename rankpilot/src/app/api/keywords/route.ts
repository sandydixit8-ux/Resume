import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { err, ok } from "@/lib/http";
import { getWebsite } from "@/lib/websites/repo";
import { all, row } from "@/lib/db/db";

const querySchema = z.object({
  websiteId: z.string().min(1),
  intent: z.string().max(40).optional(),
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
  if (q.intent) {
    where.push("intent = ?");
    params.push(q.intent);
  }
  const whereSql = where.join(" AND ");

  const total = row<{ n: number }>(`SELECT COUNT(*) AS n FROM keywords WHERE ${whereSql}`, ...params)?.n ?? 0;
  const items = all(
    `SELECT id, term, intent, volume, difficulty, current_rank, ctr, recommended_url,
            page_id, occurrences, source, updated_at
     FROM keywords WHERE ${whereSql}
     ORDER BY occurrences DESC, term ASC
     LIMIT ? OFFSET ?`,
    ...params,
    q.limit,
    q.offset
  );

  return ok({
    items: items.map((k) => ({
      ...k,
      // Never fabricate metrics: null means we have no reliable data source.
      volumeAvailable: k.volume !== null,
      difficultyAvailable: k.difficulty !== null,
      rankAvailable: k.current_rank !== null,
    })),
    total,
    note: "Search volume, difficulty and rank are shown only when connected to a data source (e.g. Google Search Console or a keyword provider).",
  });
}
