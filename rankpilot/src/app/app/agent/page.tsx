import Link from "next/link";
import { getSession } from "@/lib/auth/get-session";
import { all, row } from "@/lib/db/db";
import { Badge, Card, EmptyState } from "@/components/ui";
import { EpistemicBadge } from "@/components/growth";
import { AgentPanel } from "@/components/agent";
import { RevenuePanel } from "@/components/revenue";

export const dynamic = "force-dynamic";

export default async function AgentPage() {
  const session = (await getSession())!;
  const websites = all<{ id: string; name: string }>(
    "SELECT id, name FROM websites WHERE tenant_id = ? AND deleted_at IS NULL ORDER BY name",
    session.org.id
  );

  const latest = row<{ id: string; run_date: string; summary: string; priorities: string; opportunities: string; created_at: string }>(
    "SELECT id, run_date, summary, priorities, opportunities, created_at FROM agent_runs WHERE tenant_id = ? ORDER BY run_date DESC, created_at DESC LIMIT 1",
    session.org.id
  );

  const revenue = all<{ id: string; source: string; label: string; amount_usd: number; occurred_at: string }>(
    "SELECT id, source, label, amount_usd, occurred_at FROM revenue_events WHERE tenant_id = ? ORDER BY occurred_at DESC LIMIT 20",
    session.org.id
  );
  const total = row<{ total: number | null }>(
    "SELECT SUM(amount_usd) AS total FROM revenue_events WHERE tenant_id = ?",
    session.org.id
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">AI growth agent</h1>
        <p className="text-sm text-ink-500">
          Each run reads your latest crawl and proposes today&apos;s priorities. Every item shows what it is based on —
          observed data, not forecasts.
        </p>
      </div>

      {websites.length === 0 ? (
        <EmptyState
          title="Add a website first"
          description="The agent works from crawl data."
          action={
            <Link href="/app/websites" className="btn-primary">
              Add website
            </Link>
          }
        />
      ) : (
        <AgentPanel
          websites={websites}
          initial={
            latest
              ? {
                  id: latest.id,
                  date: latest.run_date,
                  summary: latest.summary,
                  priorities: JSON.parse(latest.priorities || "[]") as Array<{
                    title: string;
                    why: string;
                    effort: string;
                    impact: string;
                    basedOn: string;
                  }>,
                  opportunities: JSON.parse(latest.opportunities || "[]") as Array<{ title: string; severity: string }>,
                }
              : null
          }
        />
      )}

      <Card className="space-y-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-ink-900">Multi-language readiness</h2>
          <EpistemicBadge kind="observed" />
        </div>
        <LanguagePanel websiteIds={websites.map((w) => w.id)} />
      </Card>

      <div>
        <h2 className="mb-2 text-base font-semibold text-ink-900">Revenue attribution</h2>
        <RevenuePanel
          initial={revenue}
          totalUsd={Number((total?.total ?? 0).toFixed(2))}
          websites={websites}
        />
      </div>
    </div>
  );
}

function LanguagePanel({ websiteIds }: { websiteIds: string[] }) {
  if (websiteIds.length === 0) return <p className="text-sm text-ink-500">No websites.</p>;
  const placeholders = websiteIds.map(() => "?").join(",");
  const rows = all<{ lang: string | null; n: number }>(
    `SELECT lang, COUNT(*) AS n FROM pages WHERE website_id IN (${placeholders}) GROUP BY lang ORDER BY n DESC`,
    ...websiteIds
  );
  if (rows.length === 0) {
    return <p className="text-sm text-ink-500">No crawled pages yet — run a crawl to detect languages.</p>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {rows.map((r) => (
        <Badge key={r.lang ?? "unknown"} tone="low">
          {r.lang ?? "Data unavailable"} · {r.n} pages
        </Badge>
      ))}
    </div>
  );
}
