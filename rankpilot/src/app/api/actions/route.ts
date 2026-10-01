import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { err, ok } from "@/lib/http";
import { getWebsite } from "@/lib/websites/repo";
import { all, newId, nowIso, row, run } from "@/lib/db/db";
import { audit } from "@/lib/audit";
import { can } from "@/lib/auth/rbac";

const querySchema = z.object({
  websiteId: z.string().optional(),
  status: z.enum(["new", "in_progress", "review", "approved", "completed"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return err.validation(parsed.error.issues);
  const q = parsed.data;

  const where = ["a.tenant_id = ?"];
  const params: Array<string | number> = [s.org.id];
  if (q.websiteId) {
    if (!getWebsite(s.org.id, q.websiteId)) return err.notFound();
    where.push("a.website_id = ?");
    params.push(q.websiteId);
  }
  if (q.status) {
    where.push("a.status = ?");
    params.push(q.status);
  }
  const whereSql = where.join(" AND ");

  const items = all(
    `SELECT a.id, a.website_id, a.issue_id, a.title, a.description, a.priority, a.impact,
            a.effort, a.status, a.due_date, a.created_at, a.updated_at,
            w.name AS website_name, i.severity AS issue_severity, i.code AS issue_code
     FROM actions a
     LEFT JOIN websites w ON w.id = a.website_id
     LEFT JOIN seo_issues i ON i.id = a.issue_id
     WHERE ${whereSql}
     ORDER BY CASE a.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
              a.created_at DESC
     LIMIT ?`,
    ...params,
    q.limit
  );
  const counts = all<{ status: string; n: number }>(
    `SELECT status, COUNT(*) AS n FROM actions a WHERE ${whereSql} GROUP BY status`,
    ...params
  );

  return ok({ items, counts: Object.fromEntries(counts.map((c) => [c.status, c.n])) });
}

const createSchema = z.object({
  websiteId: z.string().min(1),
  issueId: z.string().optional(),
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().max(2000).optional(),
  priority: z.enum(["high", "medium", "low"]).default("medium"),
  impact: z.enum(["high", "medium", "low"]).default("medium"),
  effort: z.enum(["high", "medium", "low"]).default("medium"),
  ownerUserId: z.string().optional(),
  dueDate: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role, "actions:write")) return err.forbidden();

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return err.validation(parsed.error.issues);
  const d = parsed.data;
  if (!getWebsite(s.org.id, d.websiteId)) return err.notFound();

  const id = newId("act");
  const now = nowIso();
  run(
    `INSERT INTO actions (id, tenant_id, website_id, issue_id, title, description, priority, impact,
       effort, owner_user_id, due_date, status, source, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', 'manual', ?, ?)`,
    id,
    s.org.id,
    d.websiteId,
    d.issueId ?? null,
    d.title,
    d.description ?? "",
    d.priority,
    d.impact,
    d.effort,
    d.ownerUserId ?? null,
    d.dueDate ?? null,
    now,
    now
  );
  audit({
    tenantId: s.org.id,
    userId: s.user.id,
    action: "action.create",
    entity: "action",
    entityId: id,
    meta: { websiteId: d.websiteId, priority: d.priority, source: "manual" },
  });
  return ok({ action: row("SELECT * FROM actions WHERE id = ?", id) });
}
