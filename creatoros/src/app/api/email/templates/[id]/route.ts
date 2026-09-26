import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { ok, err, readJson } from "@/lib/http";
import { run, row, nowIso } from "@/lib/db/db";
import { audit } from "@/lib/audit";
import { can } from "@/lib/auth/rbac";

const templateSchema = z.object({
  name: z.string().min(1).max(120),
  subject: z.string().min(1).max(200),
  body: z.string().max(20000),
});

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role as never, "email:write")) return err.forbidden();
  const { id } = await params;

  const owned = row("SELECT id FROM email_templates WHERE id = ? AND tenant_id = ?", id, s.org.id);
  if (!owned) return err.notFound();

  const body = await readJson(req);
  const parsed = templateSchema.safeParse(body);
  if (!parsed.success) return err.validation(parsed.error.flatten().fieldErrors);

  run(
    "UPDATE email_templates SET name = ?, subject = ?, body = ?, updated_at = ? WHERE id = ?",
    parsed.data.name,
    parsed.data.subject,
    parsed.data.body,
    nowIso(),
    id
  );
  audit({ tenantId: s.org.id, userId: s.user.id, action: "email.template_update", resource: id });
  return ok({ templateId: id });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role as never, "email:write")) return err.forbidden();
  const { id } = await params;

  const owned = row("SELECT id FROM email_templates WHERE id = ? AND tenant_id = ?", id, s.org.id);
  if (!owned) return err.notFound();

  run("DELETE FROM email_templates WHERE id = ?", id);
  audit({ tenantId: s.org.id, userId: s.user.id, action: "email.template_delete", resource: id });
  return ok({ templateId: id });
}