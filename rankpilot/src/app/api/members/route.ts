import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { can } from "@/lib/auth/rbac";
import { err, fail, ok } from "@/lib/http";
import { row, run } from "@/lib/db/db";
import { audit } from "@/lib/audit";

const patchSchema = z.object({
  membershipId: z.string().min(1),
  role: z.enum(["owner", "admin", "editor", "analyst", "client"]),
});

export async function PATCH(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role, "members:write")) return err.forbidden();
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return err.validation(parsed.error.issues);

  const m = row<{ id: string; user_id: string; role: string }>(
    "SELECT id, user_id, role FROM memberships WHERE id = ? AND tenant_id = ?",
    parsed.data.membershipId,
    s.org.id
  );
  if (!m) return err.notFound();
  if (m.role === "owner") return fail("Owner role cannot be changed. Transfer ownership first.", 403, "forbidden");
  if (parsed.data.role === "owner") return fail("Only one owner per workspace in this build.", 403, "forbidden");

  run("UPDATE memberships SET role = ? WHERE id = ?", parsed.data.role, m.id);
  audit({
    tenantId: s.org.id,
    userId: s.user.id,
    action: "members.role_change",
    entity: "membership",
    entityId: m.id,
    meta: { from: m.role, to: parsed.data.role },
  });
  return ok({ id: m.id, role: parsed.data.role });
}

const deleteSchema = z.object({ membershipId: z.string().min(1) });

export async function DELETE(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role, "members:write")) return err.forbidden();
  const parsed = deleteSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return err.validation(parsed.error.issues);

  const m = row<{ id: string; role: string }>(
    "SELECT id, role FROM memberships WHERE id = ? AND tenant_id = ?",
    parsed.data.membershipId,
    s.org.id
  );
  if (!m) return err.notFound();
  if (m.role === "owner") return fail("The owner cannot be removed.", 403, "forbidden");

  run("DELETE FROM memberships WHERE id = ?", m.id);
  audit({ tenantId: s.org.id, userId: s.user.id, action: "members.remove", entity: "membership", entityId: m.id });
  return ok({ id: m.id, removed: true });
}
