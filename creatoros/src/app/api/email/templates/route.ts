import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { ok, err, readJson } from "@/lib/http";
import { all, run, newId, nowIso } from "@/lib/db/db";
import { audit } from "@/lib/audit";
import { can } from "@/lib/auth/rbac";

const templateSchema = z.object({
  name: z.string().min(1).max(120),
  subject: z.string().min(1).max(200),
  body: z.string().max(20000),
});

export async function GET(_req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role as never, "email:read")) return err.forbidden();
  const templates = all(
    "SELECT id, name, subject, body, updated_at FROM email_templates WHERE tenant_id = ? ORDER BY updated_at DESC",
    s.org.id
  );
  return ok({ templates });
}

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role as never, "email:write")) return err.forbidden();

  const body = await readJson(req);
  const parsed = templateSchema.safeParse(body);
  if (!parsed.success) return err.validation(parsed.error.flatten().fieldErrors);

  const id = newId("emt");
  run(
    "INSERT INTO email_templates (id, tenant_id, name, subject, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    id,
    s.org.id,
    parsed.data.name,
    parsed.data.subject,
    parsed.data.body,
    nowIso(),
    nowIso()
  );
  audit({ tenantId: s.org.id, userId: s.user.id, action: "email.template_create", resource: id });
  return ok({ templateId: id });
}