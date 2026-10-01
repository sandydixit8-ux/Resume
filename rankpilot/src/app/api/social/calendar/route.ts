import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { can } from "@/lib/auth/rbac";
import { err, ok } from "@/lib/http";
import { all, newId, nowIso, row, run } from "@/lib/db/db";
import { audit } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  const websiteId = req.nextUrl.searchParams.get("websiteId");
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  const where = ["tenant_id = ?"];
  const params: Array<string | number> = [s.org.id];
  if (websiteId) {
    where.push("website_id = ?");
    params.push(websiteId);
  }
  if (from) {
    where.push("publish_at >= ?");
    params.push(from);
  }
  if (to) {
    where.push("publish_at <= ?");
    params.push(to);
  }
  const items = all(
    `SELECT id, website_id, publish_at, platform, topic, format, hook, cta, status, content_id, social_script_id, created_at
     FROM content_calendar WHERE ${where.join(" AND ")}
     ORDER BY publish_at ASC LIMIT 300`,
    ...params
  );
  return ok({ items });
}

const createSchema = z.object({
  websiteId: z.string().optional(),
  publishAt: z.string().min(4),
  platform: z.string().min(1).max(40),
  topic: z.string().min(1).max(300),
  format: z.string().max(60).default(""),
  hook: z.string().max(500).default(""),
  cta: z.string().max(300).default(""),
  contentId: z.string().optional(),
  scriptId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role, "social:write")) return err.forbidden();
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return err.validation(parsed.error.issues);
  const d = parsed.data;

  if (d.scriptId) {
    const owned = row<{ id: string }>(
      "SELECT ss.id FROM social_scripts ss JOIN social_ideas si ON si.id = ss.idea_id JOIN social_campaigns sc ON sc.id = si.campaign_id WHERE ss.id = ? AND sc.tenant_id = ?",
      d.scriptId,
      s.org.id
    );
    if (!owned) return err.notFound();
  }

  const id = newId("cal");
  run(
    `INSERT INTO content_calendar (id, tenant_id, website_id, publish_at, platform, topic, format, hook, cta, status, content_id, social_script_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'planned', ?, ?, ?)`,
    id,
    s.org.id,
    d.websiteId ?? null,
    d.publishAt,
    d.platform,
    d.topic,
    d.format,
    d.hook,
    d.cta,
    d.contentId ?? null,
    d.scriptId ?? null,
    nowIso()
  );
  audit({
    tenantId: s.org.id,
    userId: s.user.id,
    action: "social_calendar.create",
    entity: "content_calendar",
    entityId: id,
    meta: { websiteId: d.websiteId ?? null, platform: d.platform, status: "planned" },
  });
  return ok({ id, status: "planned" });
}

const patchSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["planned", "drafted", "scheduled", "published", "skipped"]),
});

/** Status transitions only — publishing to a platform requires a connected integration. */
export async function PATCH(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role, "social:write")) return err.forbidden();
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return err.validation(parsed.error.issues);

  const item = row<{ id: string }>(
    "SELECT id FROM content_calendar WHERE id = ? AND tenant_id = ?",
    parsed.data.id,
    s.org.id
  );
  if (!item) return err.notFound();
  run("UPDATE content_calendar SET status = ? WHERE id = ?", parsed.data.status, parsed.data.id);
  audit({
    tenantId: s.org.id,
    userId: s.user.id,
    action: `social_calendar.${parsed.data.status}`,
    entity: "content_calendar",
    entityId: parsed.data.id,
    meta: { status: parsed.data.status },
  });
  return ok({ id: parsed.data.id, status: parsed.data.status });
}
