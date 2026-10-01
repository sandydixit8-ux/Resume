import { getSession } from "@/lib/auth/get-session";
import { all } from "@/lib/db/db";
import { Badge, Card, EmptyState } from "@/components/ui";
import { ReportGenerator } from "@/components/reports";
import { usageReport } from "@/lib/usage";
import { monthlySpend } from "@/lib/ai/meter";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const session = (await getSession())!;
  const items = all<{
    id: string;
    website_id: string;
    website_name: string | null;
    type: string;
    format: string;
    status: string;
    created_at: string;
    completed_at: string | null;
  }>(
    `SELECT r.id, r.website_id, r.type, r.format, r.status, r.created_at, r.completed_at, w.name AS website_name
     FROM reports r LEFT JOIN websites w ON w.id = r.website_id
     WHERE r.tenant_id = ? ORDER BY r.created_at DESC LIMIT 100`,
    session.org.id
  );

  const websites = all<{ id: string; name: string }>(
    "SELECT id, name FROM websites WHERE tenant_id = ? AND deleted_at IS NULL ORDER BY name",
    session.org.id
  );

  const usage = usageReport(session.org.id, session.org.plan);
  const spend = monthlySpend(session.org.id);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-900">Reports</h1>
          <p className="text-sm text-ink-500">
            Generated from observed crawl data. Every report carries its own methodology note.
          </p>
        </div>
        <ReportGenerator websites={websites} />
      </div>

      <Card className="grid gap-4 sm:grid-cols-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-ink-400">Reports this period</div>
          <div className="mt-1 text-lg font-semibold text-ink-900">
            {usage.metrics.find((m) => m.metric === "reports")?.used ?? 0} /{" "}
            {usage.metrics.find((m) => m.metric === "reports")?.limit ?? 0}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-ink-400">AI generations</div>
          <div className="mt-1 text-lg font-semibold text-ink-900">
            {usage.metrics.find((m) => m.metric === "aiGenerations")?.used ?? 0} /{" "}
            {usage.metrics.find((m) => m.metric === "aiGenerations")?.limit ?? 0}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-ink-400">AI spend this month</div>
          <div className="mt-1 text-lg font-semibold text-ink-900">
            ${spend.costUsd.toFixed(4)}
            <span className="ml-2 text-xs font-normal text-ink-400">{spend.calls} calls</span>
          </div>
        </div>
      </Card>

      {items.length === 0 ? (
        <EmptyState
          title="No reports yet"
          description="Generate a growth report as JSON, CSV or PDF. Formats are self-contained — no external services involved."
        />
      ) : (
        <Card className="divide-y divide-ink-100 p-0">
          {items.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-ink-900">
                  {r.type} report · {r.website_name ?? "website"}
                </div>
                <div className="text-xs text-ink-400">
                  {r.created_at.slice(0, 16).replace("T", " ")}
                </div>
              </div>
              <Badge tone="low">{r.format}</Badge>
              <Badge tone={r.status === "completed" ? "completed" : r.status === "failed" ? "critical" : "new"}>
                {r.status}
              </Badge>
              {r.status === "completed" ? (
                <a className="btn-ghost" href={`/api/reports/${r.id}`}>
                  Download
                </a>
              ) : null}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
