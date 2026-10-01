import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth/get-session";
import { all, row } from "@/lib/db/db";
import { Badge, Card, EmptyState } from "@/components/ui";
import { CampaignWorkbench } from "@/components/campaign-workbench";

export const dynamic = "force-dynamic";

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const session = (await getSession())!;
  const { id } = await params;

  const campaign = row<{
    id: string;
    website_id: string | null;
    name: string;
    platform: string;
    audience: string;
    objective: string;
    goal: string;
    status: string;
  }>(
    "SELECT id, website_id, name, platform, audience, objective, goal, status FROM social_campaigns WHERE id = ? AND tenant_id = ?",
    id,
    session.org.id
  );
  if (!campaign) notFound();

  const ideas = all<{
    id: string;
    category: string;
    title: string;
    hook: string;
    pain_point: string;
    emotional_angle: string;
    format: string;
    value: string;
    cta: string;
    selected: number;
    position: number;
  }>(
    `SELECT id, category, title, hook, pain_point, emotional_angle, format, value, cta, selected, position
     FROM social_ideas WHERE campaign_id = ? ORDER BY position ASC LIMIT 50`,
    id
  );

  const scripts = all<{
    id: string;
    idea_id: string;
    duration_sec: number;
    hook: string;
    caption: string;
    hashtags: string;
    version: number;
    created_at: string;
  }>(
    `SELECT ss.id, ss.idea_id, ss.duration_sec, ss.hook, ss.caption, ss.hashtags, ss.version, ss.created_at
     FROM social_scripts ss JOIN social_ideas si ON si.id = ss.idea_id
     WHERE si.campaign_id = ? ORDER BY ss.created_at DESC LIMIT 50`,
    id
  );

  const calendar = all<{ id: string; publish_at: string; topic: string; platform: string; status: string }>(
    "SELECT id, publish_at, topic, platform, status FROM content_calendar WHERE tenant_id = ? AND website_id IS ? ORDER BY publish_at ASC LIMIT 50",
    session.org.id,
    campaign.website_id
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <a href="/app/social" className="text-sm text-ink-400 hover:text-brand-700">
          ← Social
        </a>
        <h1 className="text-xl font-semibold text-ink-900">{campaign.name}</h1>
        <Badge tone="low">{campaign.platform}</Badge>
        <Badge tone={campaign.status === "active" ? "completed" : "ignored"}>{campaign.status}</Badge>
      </div>

      <Card className="grid gap-3 text-sm sm:grid-cols-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-ink-400">Audience</div>
          <div className="text-ink-700">{campaign.audience || "Data unavailable"}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-ink-400">Objective</div>
          <div className="text-ink-700">{campaign.objective || "Data unavailable"}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-ink-400">Goal</div>
          <div className="text-ink-700">{campaign.goal || "Data unavailable"}</div>
        </div>
      </Card>

      {ideas.length === 0 && scripts.length === 0 ? (
        <EmptyState
          title="No ideas generated yet"
          description="Generate platform-specific ideas from your brief, pick the ones you like, then turn a pick into hooks and a full script."
        />
      ) : null}

      <CampaignWorkbench
        campaignId={campaign.id}
        platform={campaign.platform}
        ideas={ideas}
        scripts={scripts}
        calendar={calendar}
      />
    </div>
  );
}
