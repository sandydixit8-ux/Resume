import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { err, ok } from "@/lib/http";
import { all, nowIso, row, run } from "@/lib/db/db";
import { audit } from "@/lib/audit";
import { can } from "@/lib/auth/rbac";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return err.auth();
  const { id } = await ctx.params;

  const issue = row<Record<string, unknown>>(
    `SELECT * FROM seo_issues WHERE id = ? AND tenant_id = ?`,
    id,
    s.org.id
  );
  if (!issue) return err.notFound();

  const page = issue.page_id
    ? row<Record<string, unknown>>(
        "SELECT id, url, title, meta_description, h1, word_count, status_code FROM pages WHERE id = ?",
        issue.page_id as string
      )
    : undefined;

  const related = all(
    `SELECT id, title, severity, status FROM seo_issues
     WHERE website_id = ? AND code = ? AND id != ? LIMIT 20`,
    issue.website_id as string,
    issue.code as string,
    id
  );

  const action = row(
    "SELECT id, status, owner_user_id, due_date FROM actions WHERE issue_id = ? ORDER BY created_at DESC LIMIT 1",
    id
  );

  return ok({
    issue: { ...issue, evidence: JSON.parse(String(issue.evidence ?? "{}")) },
    page,
    related,
    action,
  });
}

const patchSchema = z.object({
  status: z.enum(["new", "in_progress", "resolved", "ignored"]),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role, "issues:write")) return err.forbidden();

  const { id } = await ctx.params;
  const issue = row<{ id: string; website_id: string; status: string }>(
    "SELECT id, website_id, status FROM seo_issues WHERE id = ? AND tenant_id = ?",
    id,
    s.org.id
  );
  if (!issue) return err.notFound();

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return err.validation(parsed.error.issues);

  const now = nowIso();
  run(
    "UPDATE seo_issues SET status = ?, resolved_at = ?, updated_at = ? WHERE id = ?",
    parsed.data.status,
    parsed.data.status === "resolved" ? now : null,
    now,
    id
  );
  if (parsed.data.status === "resolved") {
    run(
      "UPDATE actions SET status = 'completed', completed_at = ?, updated_at = ? WHERE issue_id = ? AND status != 'completed'",
      now,
      now,
      id
    );
  }

  audit({
    tenantId: s.org.id,
    userId: s.user.id,
    action: `issue.${parsed.data.status}`,
    entity: "seo_issue",
    entityId: id,
    meta: { websiteId: issue.website_id, previousStatus: issue.status, status: parsed.data.status },
  });

  return ok({ id, status: parsed.data.status });
}
