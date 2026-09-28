import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { ok, err, readJson } from "@/lib/http";
import { row } from "@/lib/db/db";
import { audit } from "@/lib/audit";
import { can } from "@/lib/auth/rbac";
import { applyTemplate } from "@/lib/templates";

const applySchema = z.object({
  templateId: z.string().min(1),
  title: z.string().max(120).optional(),
  slug: z.string().regex(/^[a-z0-9-]{0,50}$/).optional(),
});

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role as never, "bio:write")) return err.forbidden();

  const body = await readJson(req);
  const parsed = applySchema.safeParse(body);
  if (!parsed.success) return err.validation(parsed.error.flatten().fieldErrors);

  const profile = row<{ id: string }>("SELECT id FROM profiles WHERE tenant_id = ? AND user_id = ?", s.org.id, s.user.id);
  if (!profile) return err.notFound();

  const result = applyTemplate({
    tenantId: s.org.id,
    profileId: profile.id,
    plan: s.org.plan,
    templateId: parsed.data.templateId,
    title: parsed.data.title,
    slug: parsed.data.slug,
  });

  if (!result.ok) {
    if (result.code === "premium") return err.forbidden();
    if (result.code === "quota") return err.conflict(result.message);
    return err.notFound();
  }

  audit({ tenantId: s.org.id, userId: s.user.id, action: "template.apply", resource: result.pageId, meta: { templateId: parsed.data.templateId }, ip: req.headers.get("x-forwarded-for") || undefined });
  return ok({ pageId: result.pageId });
}