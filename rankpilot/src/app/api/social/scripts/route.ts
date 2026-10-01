import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { can } from "@/lib/auth/rbac";
import { err, ok } from "@/lib/http";
import { all, newId, nowIso, row, run, tx } from "@/lib/db/db";
import { aiCall, isNextResponse } from "@/lib/ai/server";

function ownIdea(tenantId: string, ideaId: string) {
  return row<{
    id: string;
    campaign_id: string;
    title: string;
    hook: string;
    value: string;
    cta: string;
    website_id: string | null;
  }>(
    `SELECT si.id, si.campaign_id, si.title, si.hook, si.value, si.cta, sc.website_id
     FROM social_ideas si JOIN social_campaigns sc ON sc.id = si.campaign_id
     WHERE si.id = ? AND sc.tenant_id = ?`,
    ideaId,
    tenantId
  );
}

/** GET scripts for an idea or the whole campaign. */
export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  const ideaId = req.nextUrl.searchParams.get("ideaId");
  const campaignId = req.nextUrl.searchParams.get("campaignId");
  if (ideaId) {
    const items = all(
      `SELECT id, idea_id, duration_sec, structure, hook, scenes, voiceover, caption, hashtags, version, created_at
       FROM social_scripts WHERE idea_id = ? ORDER BY version DESC`,
      ideaId
    );
    return ok({ items });
  }
  if (campaignId) {
    const items = all(
      `SELECT ss.id, ss.idea_id, ss.duration_sec, ss.hook, ss.caption, ss.version, ss.created_at
       FROM social_scripts ss
       JOIN social_ideas si ON si.id = ss.idea_id
       WHERE si.campaign_id = ?
       ORDER BY ss.created_at DESC LIMIT 100`,
      campaignId
    );
    return ok({ items });
  }
  return err.validation("ideaId or campaignId required");
}

const hookSchema = z.object({ ideaId: z.string().min(1) });
const scriptSchema = z.object({
  ideaId: z.string().min(1),
  duration: z.number().int().min(10).max(180).default(30),
  hook: z.string().max(300).optional(),
});

/** POST — generate hooks (light) or a full script for an idea. */
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role, "social:write")) return err.forbidden();
  const body = await req.json().catch(() => null);

  const hookMode = hookSchema.safeParse(body);
  if (hookMode.success) {
    const idea = ownIdea(s.org.id, hookMode.data.ideaId);
    if (!idea) return err.notFound();
    const outcome = await aiCall<{ hooks: Array<{ text: string; style: string }> }>(
      "social.hooks",
      {
        websiteId: idea.website_id ?? undefined,
        render: { idea: { title: idea.title, hook: idea.hook, value: idea.value } },
        social: true,
      },
      "social:write"
    );
    if (isNextResponse(outcome)) return outcome;
    return ok({ hooks: outcome.result.data.hooks, source: outcome.result.source, degraded: outcome.result.degraded ?? null });
  }

  const parsed = scriptSchema.safeParse(body);
  if (!parsed.success) return err.validation(parsed.error.issues);
  const idea = ownIdea(s.org.id, parsed.data.ideaId);
  if (!idea) return err.notFound();

  const outcome = await aiCall<{
    hook: string;
    scenes: Array<{ start: number; end: number; visual: string; voiceover: string }>;
    voiceover: string;
    caption: string;
    hashtags: string[];
  }>(
    "social.script",
    {
      websiteId: idea.website_id ?? undefined,
      render: {
        idea: { title: idea.title, hook: parsed.data.hook || idea.hook, value: idea.value, cta: idea.cta },
        duration: parsed.data.duration,
        hook: parsed.data.hook || idea.hook,
      },
      social: true,
    },
    "social:write"
  );
  if (isNextResponse(outcome)) return outcome;
  const { result } = outcome;

  const prior =
    row<{ v: number }>("SELECT COALESCE(MAX(version), 0) AS v FROM social_scripts WHERE idea_id = ?", idea.id)?.v ?? 0;
  const id = newId("scr");
  tx(() => {
    run(
      `INSERT INTO social_scripts (id, idea_id, duration_sec, structure, hook, scenes, voiceover, caption, hashtags, version, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      idea.id,
      parsed.data.duration,
      JSON.stringify({ source: result.source, promptVersion: result.promptVersion }),
      result.data.hook,
      JSON.stringify(result.data.scenes),
      result.data.voiceover,
      result.data.caption,
      JSON.stringify(result.data.hashtags),
      prior + 1,
      nowIso()
    );
  });

  return ok({
    id,
    version: prior + 1,
    script: result.data,
    source: result.source,
    degraded: result.degraded ?? null,
    status: "draft",
    note: "Scripts are drafts. Nothing is scheduled or published without your approval.",
  });
}
