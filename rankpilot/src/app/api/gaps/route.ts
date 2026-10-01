import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { err, ok } from "@/lib/http";
import { all, run } from "@/lib/db/db";
import { getWebsite } from "@/lib/websites/repo";
import { audit } from "@/lib/audit";
import { can } from "@/lib/auth/rbac";

/** Content gaps: topics observed on competitor pages that this site does not cover. */
export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  const websiteId = req.nextUrl.searchParams.get("websiteId");
  const status = req.nextUrl.searchParams.get("status");
  if (!websiteId) return err.validation("websiteId required");
  if (!getWebsite(s.org.id, websiteId)) return err.notFound();

  const where = ["website_id = ?", "tenant_id = ?"];
  const params: Array<string | number> = [websiteId, s.org.id];
  if (status) {
    where.push("status = ?");
    params.push(status);
  }
  const items = all(
    `SELECT id, term, competitor_id, status, priority, created_at
     FROM content_gaps WHERE ${where.join(" AND ")}
     ORDER BY CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, created_at DESC
     LIMIT 200`,
    ...params
  );
  return ok({ items });
}

/** PATCH {id, status} — mark a gap planned/done/ignored. */
export async function PATCH(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role, "content:write")) return err.forbidden();
  const patchSchema = z.object({
    id: z.string().min(1).max(64),
    status: z.enum(["missing", "planned", "done", "ignored"]),
  });
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return err.validation(parsed.error.issues);
  const { id, status } = parsed.data;
  const res = run(
    "UPDATE content_gaps SET status = ? WHERE id = ? AND tenant_id = ?",
    status,
    id,
    s.org.id
  );
  if (res.changes !== 1) return err.notFound();
  audit({
    tenantId: s.org.id,
    userId: s.user.id,
    action: `content_gap.${status}`,
    entity: "content_gap",
    entityId: id,
  });
  return ok({ id, status });
}
