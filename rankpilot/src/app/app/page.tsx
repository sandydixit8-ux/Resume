import Link from "next/link";
import { getSession } from "@/lib/auth/get-session";
import { listWebsites } from "@/lib/websites/repo";
import { row } from "@/lib/db/db";
import { allUsage } from "@/lib/usage";
import { Badge, Card, EmptyState, ScoreRing, StatCard } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const session = (await getSession())!;
  const websites = listWebsites(session.org.id);
  const usage = allUsage(session.org.id);

  const topIssue = row<{
    title: string;
    severity: string;
    website_id: string;
    id: string;
    why_it_matters: string;
    recommendation: string;
  }>(
    `SELECT i.title, i.severity, i.website_id, i.id, i.why_it_matters, i.recommendation
     FROM seo_issues i JOIN websites w ON w.id = i.website_id
     WHERE i.tenant_id = ? AND i.status = 'new' AND w.deleted_at IS NULL
     ORDER BY CASE i.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END
     LIMIT 1`,
    session.org.id
  );

  const openActions =
    row<{ n: number }>(
      "SELECT COUNT(*) AS n FROM actions WHERE tenant_id = ? AND status IN ('new','in_progress','review')",
      session.org.id
    )?.n ?? 0;

  const counts = row<{ pages: number; issues: number; questions: number; keywords: number }>(
    `SELECT
       (SELECT COUNT(*) FROM pages p JOIN websites w ON w.id = p.website_id WHERE w.tenant_id = ? AND w.deleted_at IS NULL) AS pages,
       (SELECT COUNT(*) FROM seo_issues WHERE tenant_id = ? AND status = 'new') AS issues,
       (SELECT COUNT(*) FROM questions WHERE tenant_id = ?) AS questions,
       (SELECT COUNT(*) FROM keywords WHERE tenant_id = ?) AS keywords`,
    session.org.id,
    session.org.id,
    session.org.id,
    session.org.id
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-900">Overview</h1>
          <p className="text-sm text-ink-500">
            {websites.length > 0
              ? "Your highest-value opportunities, updated after every crawl."
              : "Add a website to get your first prioritized growth plan."}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/onboarding" className="btn-primary">Add website</Link>
        </div>
      </div>

      {websites.length === 0 ? (
        <EmptyState
          title="No websites yet"
          description="Enter your URL and we'll crawl, audit and rank your top SEO, AEO and GEO opportunities — you'll always know what to fix first."
          action={<Link href="/onboarding" className="btn-primary">Analyze my website</Link>}
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Websites" value={websites.length} />
            <StatCard label="Open issues" value={counts?.issues ?? 0} hint="new since last crawl" />
            <StatCard label="Open actions" value={openActions} hint="in your backlog" />
            <StatCard label="AI generations" value={usage.aiGenerations ?? 0} hint="this month" />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {websites.slice(0, 3).map((w) => (
              <Card key={w.id} className="flex items-center gap-4 p-5">
                {w.score !== null ? (
                  <ScoreRing score={w.score} size={96} />
                ) : (
                  <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full border-2 border-dashed border-ink-200 text-xs text-ink-400">
                    <span className="text-lg">—</span>
                    no score
                  </div>
                )}
                <div className="min-w-0">
                  <Link href={`/app/websites/${w.id}`} className="block truncate font-semibold text-ink-900 hover:text-brand-700">
                    {w.name}
                  </Link>
                  <div className="truncate text-xs text-ink-400">{w.normalized_url}</div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge tone={w.last_run_status === "running" ? "new" : "low"}>
                      {w.last_run_status ?? "not crawled"}
                    </Badge>
                    {w.issues_open > 0 ? <Badge tone="high">{w.issues_open} open issues</Badge> : null}
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {topIssue ? (
            <Card className="p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-400">
                  Next best action
                </h2>
                <Badge tone={topIssue.severity}>{topIssue.severity}</Badge>
              </div>
              <p className="mt-3 text-base font-semibold text-ink-900">{topIssue.title}</p>
              <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-ink-400">Why</div>
                  <p className="mt-1 text-ink-600">{topIssue.why_it_matters}</p>
                </div>
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-ink-400">Action</div>
                  <p className="mt-1 text-ink-600">{topIssue.recommendation}</p>
                </div>
                <div className="flex items-end">
                  <Link
                    href={`/app/websites/${topIssue.website_id}/issues/${topIssue.id}`}
                    className="btn-primary w-full"
                  >
                    Open & fix
                  </Link>
                </div>
              </div>
            </Card>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="p-5">
              <div className="text-3xl font-bold text-ink-900">{counts?.pages ?? 0}</div>
              <div className="text-sm text-ink-500">Pages analyzed</div>
            </Card>
            <Card className="p-5">
              <div className="text-3xl font-bold text-ink-900">{counts?.keywords ?? 0}</div>
              <div className="text-sm text-ink-500">Keywords discovered</div>
            </Card>
            <Card className="p-5">
              <div className="text-3xl font-bold text-ink-900">{counts?.questions ?? 0}</div>
              <div className="text-sm text-ink-500">AEO questions found</div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
