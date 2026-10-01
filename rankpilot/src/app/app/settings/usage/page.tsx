import { getSession } from "@/lib/auth/get-session";
import { all } from "@/lib/db/db";
import { Card, ProgressBar, Badge } from "@/components/ui";
import { usageReport } from "@/lib/usage";
import { monthlySpend } from "@/lib/ai/meter";
import { EpistemicBadge } from "@/components/growth";

export const dynamic = "force-dynamic";

const METRIC_LABELS: Record<string, string> = {
  websites: "Websites",
  keywords: "Keywords",
  aiGenerations: "AI generations",
  reports: "Reports",
  socialGenerations: "Social generations",
  pagesPerCrawl: "Pages per crawl",
  competitors: "Competitors",
};

export default async function UsagePage() {
  const s = (await getSession())!;
  const report = usageReport(s.org.id, s.org.plan);
  const spend = monthlySpend(s.org.id);
  const calls = all<{ task: string; model: string; tokens_in: number; tokens_out: number; cost_usd: number; status: string; created_at: string }>(
    "SELECT task, model, tokens_in, tokens_out, cost_usd, status, created_at FROM ai_usage WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 50",
    s.org.id
  );

  return (
    <div className="space-y-4">
      <Card className="grid gap-4 sm:grid-cols-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-ink-400">Period</div>
          <div className="text-lg font-semibold text-ink-900">{report.period}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-ink-400">AI spend this month</div>
          <div className="text-lg font-semibold text-ink-900">
            ${spend.costUsd.toFixed(4)}
            <span className="ml-2 text-xs font-normal text-ink-400">{spend.calls} calls</span>
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-ink-400">Plan</div>
          <div className="pt-1">
            <Badge tone="new">{report.plan}</Badge>
          </div>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {report.metrics.map((m) => {
          const pct = m.limit === -1 ? 100 : Math.min(100, (m.used / Math.max(1, m.limit)) * 100);
          return (
            <Card key={m.metric} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-ink-800">{METRIC_LABELS[m.metric] ?? m.metric}</span>
                <span className="text-xs text-ink-500">
                  {m.used} / {m.limit === -1 ? "∞" : m.limit}
                </span>
              </div>
              <ProgressBar value={m.limit === -1 ? 100 : pct} />
            </Card>
          );
        })}
      </div>

      <Card className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-ink-900">AI call log</h2>
          <EpistemicBadge kind="observed" />
          <span className="text-xs text-ink-400">metered from ai_usage — every call, including fallbacks</span>
        </div>
        {calls.length === 0 ? (
          <p className="text-sm text-ink-500">No AI calls recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-ink-400">
                <tr>
                  <th className="py-2 pr-3">Task</th>
                  <th className="py-2 pr-3">Model</th>
                  <th className="py-2 pr-3">Tokens in/out</th>
                  <th className="py-2 pr-3">Cost</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {calls.map((c, i) => (
                  <tr key={i}>
                    <td className="py-2 pr-3 font-medium text-ink-800">{c.task}</td>
                    <td className="py-2 pr-3 text-ink-600">{c.model}</td>
                    <td className="py-2 pr-3 text-ink-600">
                      {c.tokens_in} / {c.tokens_out}
                    </td>
                    <td className="py-2 pr-3 text-ink-600">${c.cost_usd.toFixed(5)}</td>
                    <td className="py-2 pr-3">
                      <Badge tone={c.status === "ok" ? "completed" : c.status === "quota" ? "critical" : "medium"}>
                        {c.status}
                      </Badge>
                    </td>
                    <td className="py-2 text-xs text-ink-400">{c.created_at.slice(0, 16).replace("T", " ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
