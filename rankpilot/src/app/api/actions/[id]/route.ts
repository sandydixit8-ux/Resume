import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { err, ok } from "@/lib/http";
import { nowIso, row, run } from "@/lib/db/db";
import { audit } from "@/lib/audit";
import { can } from "@/lib/auth/rbac";

const schema = z.object({
  status: z.enum(["new", "in_progress", "review", "approved", "completed"]),
  ownerUserId: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role, "actions:write")) return err.forbidden();

  const { id } = await ctx.params;
  const action = row<{ id: string }>(
    "SELECT id FROM actions WHERE id = ? AND tenant_id = ?",
    id,
    s.org.id
  );
  if (!action) return err.notFound();

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return err.validation(parsed.error.issues);
  const d = parsed.data;
  const now = nowIso();

  run(
    `UPDATE actions SET status = ?, owner_user_id = COALESCE(?, owner_user_id),
       due_date = COALESCE(?, due_date), completed_at = ?, updated_at = ? WHERE id = ?`,
    d.status,
    d.ownerUserId ?? null,
    d.dueDate ?? null,
    d.status === "completed" ? now : null,
    now,
    id
  );

  audit({
    tenantId: s.org.id,
    userId: s.user.id,
    action: `action.${d.status}`,
    entity: "action",
    entityId: id,
    meta: { status: d.status, ownerAssigned: d.ownerUserId !== undefined, dueDate: d.dueDate ?? null },
  });

  return ok({ action: row("SELECT * FROM actions WHERE id = ?", id) });
}
