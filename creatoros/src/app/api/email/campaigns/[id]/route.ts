import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { ok, err, readJson } from "@/lib/http";
import { run, row, nowIso } from "@/lib/db/db";
import { audit } from "@/lib/audit";
import { can } from "@/lib/auth/rbac";
import { listSends, campaignStats, campaignEngagement } from "@/lib/email/engine";

const campaignSchema = z.object({
  listId: z.string().nullable().optional(),
  templateId: z.string().nullable().optional(),
  subject: z.string().min(1).max(200),
  body: z.string().max(20000),
  fromName: z.string().max(120).optional().default(""),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role as never, "email:read")) return err.forbidden();
  const { id } = await params;

  const owned = row("SELECT * FROM email_campaigns WHERE id = ? AND tenant_id = ?", id, s.org.id);
  if (!owned) return err.notFound();
  const campaign = { ...owned, stats: { ...campaignStats(owned as { stats: string }), ...campaignEngagement(id) } };
  const sends = listSends(id);
  return ok({ campaign, sends });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role as never, "email:write")) return err.forbidden();
  const { id } = await params;

  const owned = row("SELECT id, status FROM email_campaigns WHERE id = ? AND tenant_id = ?", id, s.org.id);
  if (!owned) return err.notFound();
  if (owned.status === "sent" || owned.status === "sending") return err.conflict("A sent campaign cannot be edited");

  const body = await readJson(req);
  const parsed = campaignSchema.safeParse(body);
  if (!parsed.success) return err.validation(parsed.error.flatten().fieldErrors);

  run(
    "UPDATE email_campaigns SET list_id = ?, template_id = ?, subject = ?, body = ?, from_name = ?, updated_at = ? WHERE id = ?",
    parsed.data.listId ?? null,
    parsed.data.templateId ?? null,
    parsed.data.subject,
    parsed.data.body,
    parsed.data.fromName,
    nowIso(),
    id
  );
  audit({ tenantId: s.org.id, userId: s.user.id, action: "email.campaign_update", resource: id });
  return ok({ campaignId: id });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role as never, "email:write")) return err.forbidden();
  const { id } = await params;

  const owned = row("SELECT id FROM email_campaigns WHERE id = ? AND tenant_id = ?", id, s.org.id);
  if (!owned) return err.notFound();

  run("DELETE FROM email_campaigns WHERE id = ?", id);
  audit({ tenantId: s.org.id, userId: s.user.id, action: "email.campaign_delete", resource: id });
  return ok({ campaignId: id });
}