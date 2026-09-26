import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { ok, err, readJson } from "@/lib/http";
import { run, row, newId, nowIso } from "@/lib/db/db";
import { audit } from "@/lib/audit";
import { can } from "@/lib/auth/rbac";

const campaignSchema = z.object({
  listId: z.string().nullable().optional(),
  templateId: z.string().nullable().optional(),
  subject: z.string().min(1).max(200),
  body: z.string().max(20000),
  fromName: z.string().max(120).optional().default(""),
});

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role as never, "email:write")) return err.forbidden();

  const body = await readJson(req);
  const parsed = campaignSchema.safeParse(body);
  if (!parsed.success) return err.validation(parsed.error.flatten().fieldErrors);

  if (parsed.data.listId) {
    const list = row("SELECT id FROM email_lists WHERE id = ? AND tenant_id = ?", parsed.data.listId, s.org.id);
    if (!list) return err.notFound();
  }
  if (parsed.data.templateId) {
    const template = row("SELECT id FROM email_templates WHERE id = ? AND tenant_id = ?", parsed.data.templateId, s.org.id);
    if (!template) return err.notFound();
  }

  const id = newId("emc");
  run(
    "INSERT INTO email_campaigns (id, tenant_id, list_id, template_id, subject, body, from_name, status, stats, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', '{}', ?, ?)",
    id,
    s.org.id,
    parsed.data.listId ?? null,
    parsed.data.templateId ?? null,
    parsed.data.subject,
    parsed.data.body,
    parsed.data.fromName,
    nowIso(),
    nowIso()
  );
  audit({ tenantId: s.org.id, userId: s.user.id, action: "email.campaign_create", resource: id });
  return ok({ campaignId: id });
}
