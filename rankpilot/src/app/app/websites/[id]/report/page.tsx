import { getSession } from "@/lib/auth/get-session";
import { getWebsite } from "@/lib/websites/repo";
import { all, row } from "@/lib/db/db";
import { Badge, Card, EmptyState, ProgressBar, ScoreRing } from "@/components/ui";

export const dynamic = "force-dynamic";

interface Methodology {
  formula: string;
  componentFormula: string;
  weights: Record<string, number>;
  components: Array<{
    name: string;
    category: string;
    weight: number;
    score: number | null;
    checks: Array<{ code: string; title: string; severity: string; weight: number; applicable: number; failed: number }>;
  }>;
  unavailable: string[];
}

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const session = (await getSession())!;
  const { id } = await params;
  const website = getWebsite(session.org.id, id);
  if (!website) return null;

  const score = row<{ overall: number; methodology: string; created_at: string }>(
    "SELECT overall, methodology, created_at FROM scores WHERE website_id = ? ORDER BY created_at DESC LIMIT 1",
    id
  );
  const run = row<{ status: string; pages_analyzed: number; created_at: string; finished_at: string | null }>(
    "SELECT status, pages_analyzed, created_at, finished_at FROM crawl_runs WHERE website_id = ? ORDER BY created_at DESC LIMIT 1",
    id
  );
  const counts = row<{ new_i: number; resolved_i: number; questions: number; keywords: number }>(
    `SELECT
       (SELECT COUNT(*) FROM seo_issues WHERE website_id = ? AND status = 'new') AS new_i,
       (SELECT COUNT(*) FROM seo_issues WHERE website_id = ? AND status = 'resolved') AS resolved_i,
       (SELECT COUNT(*) FROM questions WHERE website_id = ?) AS questions,
       (SELECT COUNT(*) FROM keywords WHERE website_id = ?) AS keywords`,
    id,
    id,
    id,
    id
  );
  const topIssues = all<{ id: string; title: string; severity: string; recommendation: string }>(
    `SELECT id, title, severity, recommendation FROM seo_issues
     WHERE website_id = ? AND status = 'new'
     ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END
     LIMIT 10`,
    id
  );

  if (!score || !run) {
    return (
      <EmptyState
        title="No report yet"
        description="Your Growth Report is generated after the first crawl. Start an audit from the Overview tab."
      />
    );
  }

  const methodology = JSON.parse(score.methodology || "{}") as Methodology;

  return (
    <div className="space-y-5">
      <Card className="flex flex-col items-center gap-6 p-6 sm:flex-row sm:items-start">
        <ScoreRing score={score.overall} size={150} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={score.overall >= 80 ? "completed" : score.overall >= 60 ? "new" : score.overall >= 40 ? "medium" : "critical"}>
              {score.overall >= 80 ? "strong" : score.overall >= 60 ? "solid base" : score.overall >= 40 ? "needs work" : "critical gaps"}
            </Badge>
            <span className="text-xs text-ink-400">
              computed {new Date(score.created_at).toLocaleString()} · {run.pages_analyzed} pages
            </span>
          </div>
          <p className="mt-3 text-sm leading-6 text-ink-600">{methodology.formula}</p>
          <p className="mt-2 text-sm leading-6 text-ink-500">{methodology.componentFormula}</p>
          {methodology.unavailable?.length ? (
            <p className="mt-2 text-xs text-ink-400">
              Excluded for lack of data (never guessed): {methodology.unavailable.join(", ")}
            </p>
          ) : null}
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-ink-400">Open issues</div>
          <div className="mt-1 text-2xl font-semibold text-ink-900">{counts?.new_i ?? 0}</div>
        </Card>
        <Card className="px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-ink-400">Resolved</div>
          <div className="mt-1 text-2xl font-semibold text-ink-900">{counts?.resolved_i ?? 0}</div>
        </Card>
        <Card className="px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-ink-400">Keywords</div>
          <div className="mt-1 text-2xl font-semibold text-ink-900">{counts?.keywords ?? 0}</div>
        </Card>
        <Card className="px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-ink-400">AEO questions</div>
          <div className="mt-1 text-2xl font-semibold text-ink-900">{counts?.questions ?? 0}</div>
        </Card>
      </div>

      <Card className="p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-400">
          Score methodology — component breakdown
        </h2>
        <div className="mt-4 space-y-5">
          {(methodology.components ?? []).map((c) => (
            <div key={c.category}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="font-medium text-ink-800">
                  {c.name}
                  <span className="ml-2 text-xs font-normal text-ink-400">
                    weight {(c.weight * 100).toFixed(0)}%
                  </span>
                </span>
                <span className="font-semibold text-ink-900">{c.score ?? "—"}</span>
              </div>
              <ProgressBar value={c.score ?? 0} />
              <div className="mt-2 space-y-1">
                {c.checks.map((k) => (
                  <div key={k.code} className="flex items-start justify-between gap-3 text-xs">
                    <span className="min-w-0 truncate text-ink-600">
                      <span className="mr-1.5 font-mono text-ink-400">{k.code}</span>
                      {k.title}
                    </span>
                    <span className={`shrink-0 ${k.failed > 0 ? "text-red-600" : "text-emerald-600"}`}>
                      {k.applicable - k.failed}/{k.applicable} pass
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-400">Prioritized fixes</h2>
        {topIssues.length === 0 ? (
          <p className="mt-3 text-sm text-ink-500">Nothing open right now — celebrate, then keep improving.</p>
        ) : (
          <ol className="mt-3 space-y-3">
            {topIssues.map((i, idx) => (
              <li key={i.id} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink-100 text-xs font-semibold text-ink-600">
                  {idx + 1}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={i.severity}>{i.severity}</Badge>
                    <span className="text-sm font-medium text-ink-900">{i.title}</span>
                  </div>
                  <p className="mt-1 text-sm text-ink-600">{i.recommendation}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Card>

      <p className="text-xs leading-5 text-ink-400">
        Disclaimer: RankPilot improves the measurable factors behind search and AI visibility.
        It does not guarantee rankings, traffic, citations or revenue — results depend on your
        implementation and the market. Metrics marked “Data unavailable” mean we have no reliable
        source for them yet.
      </p>
    </div>
  );
}
