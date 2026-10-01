import Link from "next/link";
import { getSession } from "@/lib/auth/get-session";
import { getWebsite } from "@/lib/websites/repo";
import { all, row } from "@/lib/db/db";
import { Badge, Card, EmptyState } from "@/components/ui";
import { AddCompetitorButton } from "@/components/competitors";

export const dynamic = "force-dynamic";

export default async function CompetitorsPage({ params }: { params: Promise<{ id: string }> }) {
  const session = (await getSession())!;
  const { id } = await params;
  const website = getWebsite(session.org.id, id);
  if (!website) return null;

  const competitors = all<{
    id: string;
    url: string;
    name: string;
    status: string;
    score: number | null;
    overlap_keywords: number;
    last_audited_at: string | null;
  }>(
    `SELECT id, url, name, status, score, overlap_keywords, last_audited_at
     FROM competitors WHERE website_id = ? AND tenant_id = ? ORDER BY created_at DESC LIMIT 100`,
    id,
    session.org.id
  );

  const gaps = all<{ id: string; term: string; status: string; priority: string }>(
    `SELECT id, term, status, priority FROM content_gaps
     WHERE website_id = ? AND tenant_id = ? AND status != 'ignored'
     ORDER BY created_at DESC LIMIT 50`,
    id,
    session.org.id
  );

  const ownScore =
    row<{ overall: number }>(
      "SELECT overall FROM scores WHERE website_id = ? ORDER BY created_at DESC LIMIT 1",
      id
    )?.overall ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink-900">Competitor intelligence</h2>
          <p className="text-sm text-ink-500">
            Scores come from observed single-page audits — no traffic or ranking estimates.
          </p>
        </div>
        <AddCompetitorButton websiteId={id} />
      </div>

      <Card className="px-4 py-3 text-sm text-ink-600">
        Your score:{" "}
        <span className="font-semibold text-ink-900">{ownScore ?? "Data unavailable"}</span> — comparisons below are
        on the same methodology (observed page checks, same weights).
      </Card>

      {competitors.length === 0 ? (
        <EmptyState
          title="No competitors tracked"
          description="Add a competitor URL. We audit their page with the same checks we run on yours and highlight topic gaps you can act on."
        />
      ) : (
        <Card className="divide-y divide-ink-100 p-0">
          {competitors.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-ink-900">{c.name}</div>
                <div className="truncate text-xs text-ink-400">{c.url}</div>
              </div>
              <Badge tone={c.status === "audited" ? "completed" : c.status === "failed" ? "critical" : "new"}>
                {c.status}
              </Badge>
              <div className="w-24 text-right">
                <div className="text-lg font-semibold text-ink-900">{c.score ?? "—"}</div>
                <div className="text-[11px] text-ink-400">page score</div>
              </div>
              <div className="w-28 text-right">
                <div className="text-sm font-medium text-ink-700">{c.overlap_keywords}</div>
                <div className="text-[11px] text-ink-400">shared topics</div>
              </div>
            </div>
          ))}
        </Card>
      )}

      <div>
        <h3 className="mb-2 text-sm font-semibold text-ink-900">Content gaps</h3>
        {gaps.length === 0 ? (
          <p className="text-sm text-ink-500">No gaps identified yet — audit at least one competitor first.</p>
        ) : (
          <Card className="flex flex-wrap gap-2 p-4">
            {gaps.map((g) => (
              <span key={g.id} className="inline-flex items-center gap-1.5">
                <Badge tone={g.status === "done" ? "completed" : g.status === "planned" ? "new" : g.priority}>
                  {g.term}
                </Badge>
              </span>
            ))}
          </Card>
        )}
      </div>

      <p className="text-xs text-ink-400">
        Track topic coverage in the{" "}
        <Link className="text-brand-700 hover:underline" href={`/app/websites/${id}/topics`}>
          topic map
        </Link>
        .
      </p>
    </div>
  );
}
