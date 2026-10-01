"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { api } from "@/lib/client";
import { Badge, Card } from "@/components/ui";
import { EpistemicBadge } from "@/components/growth";

type Priority = { title: string; why: string; effort: string; impact: string; basedOn: string };
type Opportunity = { title: string; severity: string };
type Run = { id: string; date: string; summary: string; priorities: Priority[]; opportunities: Opportunity[] };

export function AgentPanel({ websites, initial }: { websites: Array<{ id: string; name: string }>; initial: Run | null }) {
  const router = useRouter();
  const [websiteId, setWebsiteId] = useState(websites[0]?.id ?? "");
  const [run, setRun] = useState<Run | null>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [degraded, setDegraded] = useState<string | null>(null);
  const idRef = useRef(0);

  async function runAgent() {
    setBusy(true);
    setError(null);
    const res = await api<{
      runId: string;
      summary: string;
      priorities: Priority[];
      opportunities: Opportunity[];
      degraded?: string | null;
    }>("/api/agent", { method: "POST", json: { websiteId } });
    setBusy(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    setDegraded(res.data.degraded ?? null);
    idRef.current += 1;
    setRun({
      id: res.data.runId,
      date: new Date().toISOString().slice(0, 10),
      summary: res.data.summary,
      priorities: res.data.priorities,
      opportunities: res.data.opportunities,
    });
    router.refresh();
  }

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs text-ink-500">
          Website
          <select className="input ml-2 w-auto" value={websiteId} onChange={(e) => setWebsiteId(e.target.value)}>
            {websites.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </label>
        <button className="btn-primary ml-auto" onClick={runAgent} disabled={busy}>
          {busy ? "Reading crawl data…" : "Run agent"}
        </button>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {degraded ? (
        <p className="flex items-center gap-2 text-xs text-amber-700">
          <EpistemicBadge kind="interpretation" /> {degraded}
        </p>
      ) : null}

      {!run ? (
        <p className="text-sm text-ink-500">
          No run yet. The agent will read your latest crawl and propose today&apos;s priorities.
        </p>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <EpistemicBadge kind="observed" />
            <span className="text-sm text-ink-600">{run.summary}</span>
            <span className="ml-auto text-xs text-ink-400">{run.date}</span>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-ink-900">Today&apos;s priorities</h3>
              {run.priorities.length === 0 ? (
                <p className="text-sm text-ink-500">Nothing urgent — no open critical/high issues.</p>
              ) : (
                run.priorities.map((p, i) => (
                  <div key={i} className="rounded-xl border border-ink-200 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-ink-900">{p.title}</span>
                      <Badge tone={p.impact === "high" ? "high" : "medium"}>{p.impact} impact</Badge>
                      <Badge tone="low">{p.effort} effort</Badge>
                    </div>
                    <p className="mt-1 text-xs text-ink-600">{p.why}</p>
                    <p className="mt-1 text-[11px] text-ink-400">Based on: {p.basedOn}</p>
                  </div>
                ))
              )}
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-ink-900">Opportunities found</h3>
              {run.opportunities.length === 0 ? (
                <p className="text-sm text-ink-500">No open critical/high opportunities in the last crawl.</p>
              ) : (
                <ul className="space-y-1.5">
                  {run.opportunities.map((o, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-ink-700">
                      <Badge tone={o.severity}>{o.severity}</Badge>
                      <span className="truncate">{o.title}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <p className="border-t border-ink-100 pt-2 text-xs text-ink-400">
            The top priority is also queued in the{" "}
            <a href="/app/actions" className="text-brand-700 hover:underline">
              Action Center
            </a>
            . The agent never publishes or fixes anything on its own.
          </p>
        </div>
      )}
    </Card>
  );
}
