import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { can } from "@/lib/auth/rbac";
import { err, ok } from "@/lib/http";
import { all, newId, nowIso, row, run } from "@/lib/db/db";
import { aiCall, isNextResponse } from "@/lib/ai/server";

const genSchema = z.object({
  campaignId: z.string().min(1),
  count: z.number().int().min(1).max(20).default(6),
});

export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  const campaignId = req.nextUrl.searchParams.get("campaignId");
  if (!campaignId) return err.validation("campaignId required");
  const owns = row<{ id: string }>(
    "SELECT id FROM social_campaigns WHERE id = ? AND tenant_id = ?",
    campaignId,
    s.org.id
  );
  if (!owns) return err.notFound();
  const items = all(
    `SELECT id, campaign_id, category, title, hook, pain_point, emotional_angle, format, value, cta, platform, selected, position, created_at
     FROM social_ideas WHERE campaign_id = ? ORDER BY position ASC LIMIT 50`,
    campaignId
  );
  return ok({ items });
}

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role, "social:write")) return err.forbidden();
  const parsed = genSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return err.validation(parsed.error.issues);

  const campaign = row<{
    id: string;
    website_id: string | null;
    name: string;
    platform: string;
    audience: string;
    objective: string;
    goal: string;
  }>(
    "SELECT id, website_id, name, platform, audience, objective, goal FROM social_campaigns WHERE id = ? AND tenant_id = ?",
    parsed.data.campaignId,
    s.org.id
  );
  if (!campaign) return err.notFound();

  const brief = {
    name: campaign.name,
    platform: campaign.platform,
    audience: campaign.audience,
    objective: campaign.objective,
    goal: campaign.goal,
    count: parsed.data.count,
  };
  const outcome = await aiCall<{
    ideas: Array<{ category: string; title: string; hook: string; painPoint: string; emotionalAngle: string; format: string; value: string; cta: string }>;
  }>(
    "social.ideas",
    { websiteId: campaign.website_id ?? undefined, brief, render: { brief }, social: true },
    "social:write"
  );
  if (isNextResponse(outcome)) return outcome;
  const { result } = outcome;

  const now = nowIso();
  const ids: string[] = [];
  const existing = row<{ n: number }>(
    "SELECT COUNT(*) AS n FROM social_ideas WHERE campaign_id = ?",
    campaign.id
  );
  let position = existing?.n ?? 0;
  for (const idea of result.data.ideas.slice(0, parsed.data.count)) {
    const ideaId = newId("ida");
    run(
      `INSERT INTO social_ideas (id, campaign_id, category, title, hook, pain_point, emotional_angle, format, value, cta, platform, goal, position, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ideaId,
      campaign.id,
      idea.category,
      idea.title,
      idea.hook,
      idea.painPoint,
      idea.emotionalAngle,
      idea.format,
      idea.value,
      idea.cta,
      campaign.platform,
      campaign.goal,
      position++,
      now
    );
    ids.push(ideaId);
  }

  return ok({ ids, source: result.source, degraded: result.degraded ?? null });
}
