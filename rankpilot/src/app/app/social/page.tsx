import Link from "next/link";
import { getSession } from "@/lib/auth/get-session";
import { all } from "@/lib/db/db";
import { Badge, Card, EmptyState } from "@/components/ui";
import { NewCampaignButton } from "@/components/social";

export const dynamic = "force-dynamic";

export default async function SocialPage() {
  const session = (await getSession())!;
  const items = all<{
    id: string;
    name: string;
    platform: string;
    objective: string;
    status: string;
    created_at: string;
    ideas: number;
  }>(
    `SELECT sc.id, sc.name, sc.platform, sc.objective, sc.status, sc.created_at,
            (SELECT COUNT(*) FROM social_ideas si WHERE si.campaign_id = sc.id) AS ideas
     FROM social_campaigns sc WHERE sc.tenant_id = ?
     ORDER BY sc.created_at DESC LIMIT 100`,
    session.org.id
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-900">Social growth</h1>
          <p className="text-sm text-ink-500">
            Campaigns → ideas → hooks → scripts → calendar. Publishing requires an approved post and a connected
            account; nothing posts automatically.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/app/social/calendar" className="btn-secondary">
            Calendar
          </Link>
          <NewCampaignButton />
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="No campaigns yet"
          description="Create a campaign to generate platform-specific ideas from your audience and goal, then turn picks into hooks and scripts."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((c) => (
            <Link key={c.id} href={`/app/social/campaigns/${c.id}`}>
              <Card className="h-full space-y-2 hover:border-brand-300">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-ink-900">{c.name}</span>
                  <Badge tone="low">{c.platform}</Badge>
                </div>
                <p className="line-clamp-2 text-xs text-ink-500">{c.objective || "No objective set"}</p>
                <div className="flex items-center justify-between text-xs text-ink-400">
                  <span>{c.ideas} ideas</span>
                  <span>{c.created_at.slice(0, 10)}</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
