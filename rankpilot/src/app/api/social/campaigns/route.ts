import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { can } from "@/lib/auth/rbac";
import { err, ok } from "@/lib/http";
import { all, newId, nowIso, row, run } from "@/lib/db/db";
import { getWebsite } from "@/lib/websites/repo";
import { audit } from "@/lib/audit";

const createSchema = z.object({
  websiteId: z.string().optional(),
  name: z.string().min(1).max(200),
  platform: z.enum(["linkedin", "x", "instagram", "tiktok", "youtube", "facebook"]),
  audience: z.string().max(300).default(""),
  objective: z.string().max(300).default(""),
  goal: z.string().max(300).default(""),
});

export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  const websiteId = req.nextUrl.searchParams.get("websiteId");
  const where = websiteId ? "website_id = ? AND tenant_id = ?" : "tenant_id = ?";
  const params = websiteId ? [websiteId, s.org.id] : [s.org.id];
  const items = all(
    `SELECT id, website_id, name, platform, audience, objective, goal, status, created_at
     FROM social_campaigns WHERE ${where} ORDER BY created_at DESC LIMIT 100`,
    ...params
  );
  return ok({ items });
}

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role, "social:write")) return err.forbidden();
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return err.validation(parsed.error.issues);
  const d = parsed.data;
  if (d.websiteId && !getWebsite(s.org.id, d.websiteId)) return err.notFound();

  const id = newId("cmp");
  run(
    `INSERT INTO social_campaigns (id, tenant_id, website_id, name, platform, audience, objective, goal, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
    id,
    s.org.id,
    d.websiteId ?? null,
    d.name,
    d.platform,
    d.audience,
    d.objective,
    d.goal,
    nowIso()
  );
  audit({
    tenantId: s.org.id,
    userId: s.user.id,
    action: "social_campaign.create",
    entity: "social_campaign",
    entityId: id,
    meta: { websiteId: d.websiteId ?? null, platform: d.platform },
  });
  return ok({ id });
}

export async function PATCH(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role, "social:write")) return err.forbidden();
  const body = await req.json().catch(() => null);
  const sel = z.object({ ideaId: z.string(), selected: z.boolean() }).safeParse(body);
  if (sel.success) {
    const idea = row<{ id: string }>(
      "SELECT si.id FROM social_ideas si JOIN social_campaigns sc ON sc.id = si.campaign_id WHERE si.id = ? AND sc.tenant_id = ?",
      sel.data.ideaId,
      s.org.id
    );
    if (!idea) return err.notFound();
    run("UPDATE social_ideas SET selected = ? WHERE id = ?", sel.data.selected ? 1 : 0, sel.data.ideaId);
    audit({
      tenantId: s.org.id,
      userId: s.user.id,
      action: "social_idea.select",
      entity: "social_idea",
      entityId: sel.data.ideaId,
      meta: { selected: sel.data.selected },
    });
    return ok({ id: sel.data.ideaId, selected: sel.data.selected });
  }
  return err.validation("ideaId required");
}
