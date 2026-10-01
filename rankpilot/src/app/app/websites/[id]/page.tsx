import Link from "next/link";
import { getSession } from "@/lib/auth/get-session";
import { getWebsite } from "@/lib/websites/repo";
import { all, row } from "@/lib/db/db";
import { COMPONENT_LABELS } from "@/lib/scoring/score";
import { Badge, Card, ProgressBar, ScoreRing, StatCard } from "@/components/ui";
import { CrawlButton } from "@/components/website";

export const dynamic = "force-dynamic";

interface ScoreRow {
  overall: number;
  components: string;
  methodology: string;
  created_at: string;
  run_id: string | null;
}

interface RunRow {
  id: string;
  status: string;
  pages_discovered: number;
  pages_analyzed: number;
  issues_found: number;
  keywords_found: number;
  questions_found: number;
  created_at: string;
  finished_at: string | null;
}

export default async function WebsiteOverview({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = (await getSession())!;
  const { id } = await params;
  const website = getWebsite(session.org.id, id);
  if (!website) return null;

  const score = row<ScoreRow>(
    "SELECT overall, components, methodology, created_at, run_id FROM scores WHERE website_id = ? ORDER BY created_at DESC LIMIT 1",
    id
  );
  const run = row<RunRow>(
    `SELECT id, status, pages_discovered, pages_analyzed, issues_found, keywords_found,
            questions_found, created_at, finished_at
     FROM crawl_runs WHERE website_id = ? ORDER BY created_at DESC LIMIT 1`,
    id
  );
  const severityCounts = all<{ severity: string; n: number }>(
    "SELECT severity, COUNT(*) AS n FROM seo_issues WHERE website_id = ? AND status = 'new' GROUP BY severity",
    id
  );
  const topIssues = all<{
    id: string;
    code: string;
    title: string;
    severity: string;
    category: string;
    why_it_matters: string;
    page_id: string | null;
  }>(
    `SELECT id, code, title, severity, category, why_it_matters, page_id
     FROM seo_issues WHERE website_id = ? AND status = 'new'
     ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
              created_at ASC
     LIMIT 5`,
    id
  );

  const components = score ? (JSON.parse(score.components) as Record<string, { score: number; weightApplied: number }>) : {};
  const sevMap = Object.fromEntries(severityCounts.map((c) => [c.severity, c.n]));
  const running = run?.status === "running" || run?.status === "queued";
  const active = run ?? null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-ink-500">
          {active
            ? `Last run ${active.status} · ${active.pages_analyzed} pages analyzed · ${new Date(active.created_at).toLocaleString()}`
            : "No crawls yet — run your first audit to get a score."}
        </div>
        <CrawlButton websiteId={id} running={running} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="flex flex-col items-center gap-4 p-6">
          {score ? (
            <ScoreRing score={score.overall} size={140} />
          ) : (
            <div className="flex h-36 w-36 flex-col items-center justify-center rounded-full border-2 border-dashed border-ink-200 text-ink-400">
              <span className="text-2xl">—</span>
              <span className="text-xs">no score yet</span>
            </div>
          )}
          <div className="text-center">
            <div className="text-sm font-semibold text-ink-800">Growth Score</div>
            <div className="text-xs text-ink-400">
              {score ? `computed ${new Date(score.created_at).toLocaleString()}` : "run a crawl to compute"}
            </div>
          </div>
        </Card>

        <Card className="p-6 lg:col-span-2">
          <div className="text-sm font-semibold uppercase tracking-wide text-ink-400">Components</div>
          {Object.keys(components).length === 0 ? (
            <p className="mt-3 text-sm text-ink-500">
              Component scores appear after your first crawl. We never guess — unavailable
              components are excluded from the overall score.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {Object.entries(components)
                .sort((a, b) => b[1].score - a[1].score)
                .map(([key, c]) => (
                  <div key={key}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="text-ink-700">{COMPONENT_LABELS[key] ?? key}</span>
                      <span className="font-medium text-ink-900">
                        {c.score}
                        <span className="ml-2 text-xs font-normal text-ink-400">
                          weight {(c.weightApplied * 100).toFixed(0)}%
                        </span>
                      </span>
                    </div>
                    <ProgressBar value={c.score} />
                  </div>
                ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Critical" value={sevMap.critical ?? 0} />
        <StatCard label="High" value={sevMap.high ?? 0} />
        <StatCard label="Medium" value={sevMap.medium ?? 0} />
        <StatCard label="Low" value={sevMap.low ?? 0} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Pages analyzed" value={active?.pages_analyzed ?? 0} hint={`of ${active?.pages_discovered ?? 0} discovered`} />
        <StatCard label="Keywords" value={active?.keywords_found ?? 0} hint="discovered from content" />
        <StatCard label="Questions" value={active?.questions_found ?? 0} hint="AEO opportunities" />
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-400">Top issues</h2>
          <Link href={`/app/websites/${id}/issues`} className="text-sm font-medium text-brand-600 hover:underline">
            View all →
          </Link>
        </div>
        {topIssues.length === 0 ? (
          <p className="mt-3 text-sm text-ink-500">No open issues — either nothing found yet or everything is resolved.</p>
        ) : (
          <ul className="mt-3 divide-y divide-ink-100">
            {topIssues.map((i) => (
              <li key={i.id} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <Link
                    href={`/app/websites/${id}/issues/${i.id}`}
                    className="block truncate text-sm font-medium text-ink-900 hover:text-brand-700"
                  >
                    {i.title}
                  </Link>
                  <div className="mt-0.5 line-clamp-1 text-xs text-ink-500">{i.why_it_matters}</div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge tone={i.severity}>{i.severity}</Badge>
                  <Badge tone="low">{i.category}</Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
