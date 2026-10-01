import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { err, ok } from "@/lib/http";
import { getWebsite } from "@/lib/websites/repo";
import { nowIso, row, run } from "@/lib/db/db";
import { audit } from "@/lib/audit";
import { can } from "@/lib/auth/rbac";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Params) {
  const s = await getSession();
  if (!s) return err.auth();
  const { id } = await ctx.params;
  const website = getWebsite(s.org.id, id);
  if (!website) return err.notFound();

  const latestRun = row(
    `SELECT id, status, trigger, pages_discovered, pages_analyzed, issues_found,
            keywords_found, questions_found, started_at, finished_at, error
     FROM crawl_runs WHERE website_id = ? ORDER BY created_at DESC LIMIT 1`,
    id
  );
  const score = row(
    "SELECT overall, components, methodology, run_id, created_at FROM scores WHERE website_id = ? ORDER BY created_at DESC LIMIT 1",
    id
  );
  const issueCounts = row<{ critical: number; high: number; medium: number; low: number }>(
    `SELECT
       COALESCE(SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END), 0) AS critical,
       COALESCE(SUM(CASE WHEN severity = 'high' THEN 1 ELSE 0 END), 0) AS high,
       COALESCE(SUM(CASE WHEN severity = 'medium' THEN 1 ELSE 0 END), 0) AS medium,
       COALESCE(SUM(CASE WHEN severity = 'low' THEN 1 ELSE 0 END), 0) AS low
     FROM seo_issues WHERE website_id = ? AND status = 'new'`,
    id
  );

  return ok({
    website,
    latestRun,
    score,
    issueCounts: issueCounts ?? { critical: 0, high: 0, medium: 0, low: 0 },
  });
}

const patchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  industry: z.string().trim().max(120).nullable().optional(),
  country: z.string().trim().max(80).nullable().optional(),
  audience: z.string().trim().max(300).nullable().optional(),
  products: z.string().trim().max(500).nullable().optional(),
  primaryKeywords: z.string().trim().max(500).nullable().optional(),
  targetMarket: z.string().trim().max(200).nullable().optional(),
  competitors: z.array(z.string().max(300)).max(10).optional(),
});

const COLUMN_MAP: Record<string, string> = {
  name: "name",
  industry: "industry",
  country: "country",
  audience: "audience",
  products: "products",
  primaryKeywords: "primary_keywords",
  targetMarket: "target_market",
};

export async function PATCH(req: NextRequest, ctx: Params) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role, "website:write")) return err.forbidden();
  const { id } = await ctx.params;
  if (!getWebsite(s.org.id, id)) return err.notFound();

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return err.validation(parsed.error.issues);

  const now = nowIso();
  const changed: string[] = [];
  for (const [key, value] of Object.entries(parsed.data)) {
    if (value === undefined) continue;
    if (key === "competitors") {
      run(
        "UPDATE websites SET competitor_urls = ?, updated_at = ? WHERE id = ? AND tenant_id = ?",
        JSON.stringify(value),
        now,
        id,
        s.org.id
      );
      changed.push(key);
      continue;
    }
    const column = COLUMN_MAP[key];
    if (!column) continue;
    run(
      `UPDATE websites SET ${column} = ?, updated_at = ? WHERE id = ? AND tenant_id = ?`,
      value === null ? null : String(value),
      now,
      id,
      s.org.id
    );
    changed.push(key);
  }

  audit({
    tenantId: s.org.id,
    userId: s.user.id,
    action: "website.update",
    entity: "website",
    entityId: id,
    meta: { fields: changed },
  });
  return ok({ website: getWebsite(s.org.id, id) });
}

export async function DELETE(_req: NextRequest, ctx: Params) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role, "website:delete")) return err.forbidden();
  const { id } = await ctx.params;
  if (!getWebsite(s.org.id, id)) return err.notFound();
  const now = nowIso();
  run(
    "UPDATE websites SET deleted_at = ?, updated_at = ? WHERE id = ? AND tenant_id = ?",
    now,
    now,
    id,
    s.org.id
  );
  audit({
    tenantId: s.org.id,
    userId: s.user.id,
    action: "website.delete",
    entity: "website",
    entityId: id,
    meta: { softDelete: true },
  });
  return ok({ deleted: true });
}
