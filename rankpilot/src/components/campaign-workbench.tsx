"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";
import { Badge, Card } from "@/components/ui";
import { EpistemicBadge } from "@/components/growth";

type Idea = {
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
};

type Script = {
  id: string;
  idea_id: string;
  duration_sec: number;
  hook: string;
  caption: string;
  hashtags: string;
  version: number;
  created_at: string;
};

type CalItem = { id: string; publish_at: string; topic: string; platform: string; status: string };

export function CampaignWorkbench({
  campaignId,
  platform,
  ideas,
  scripts,
  calendar,
}: {
  campaignId: string;
  platform: string;
  ideas: Idea[];
  scripts: Script[];
  calendar: CalItem[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hooks, setHooks] = useState<Array<{ text: string; style: string }> | null>(null);
  const [scriptView, setScriptView] = useState<Record<string, unknown> | null>(null);
  const [degraded, setDegraded] = useState<string | null>(null);

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key);
    setError(null);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  }

  const generateIdeas = () =>
    run("ideas", async () => {
      const res = await api<{ source: string; degraded?: string | null }>("/api/social/ideas", {
        method: "POST",
        json: { campaignId, count: 6 },
      });
      if (!res.ok) return setError(res.error.message);
      setDegraded(res.data.degraded ?? null);
      router.refresh();
    });

  const toggleSelect = (ideaId: string, selected: boolean) =>
    run(`sel-${ideaId}`, async () => {
      const res = await api("/api/social/campaigns", { method: "PATCH", json: { ideaId, selected } });
      if (!res.ok) return setError(res.error.message);
      router.refresh();
    });

  const getHooks = (ideaId: string) =>
    run(`hooks-${ideaId}`, async () => {
      const res = await api<{ hooks: Array<{ text: string; style: string }>; degraded?: string | null }>(
        "/api/social/scripts",
        { method: "POST", json: { ideaId } }
      );
      if (!res.ok) return setError(res.error.message);
      setHooks(res.data.hooks);
      setDegraded(res.data.degraded ?? null);
    });

  const makeScript = (ideaId: string, duration: number) =>
    run(`script-${ideaId}`, async () => {
      const res = await api<{ script: Record<string, unknown>; degraded?: string | null }>("/api/social/scripts", {
        method: "POST",
        json: { ideaId, duration },
      });
      if (!res.ok) return setError(res.error.message);
      setScriptView(res.data.script);
      setDegraded(res.data.degraded ?? null);
      router.refresh();
    });

  const schedule = (idea: Idea) =>
    run(`cal-${idea.id}`, async () => {
      const at = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const res = await api("/api/social/calendar", {
        method: "POST",
        json: { publishAt: at, platform, topic: idea.title, hook: idea.hook, cta: idea.cta },
      });
      if (!res.ok) return setError(res.error.message);
      router.refresh();
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-primary" onClick={generateIdeas} disabled={busy === "ideas"}>
          {busy === "ideas" ? "Generating…" : ideas.length ? "Generate more ideas" : "Generate ideas"}
        </button>
        {degraded ? (
          <span className="flex items-center gap-2 text-xs text-amber-700">
            <EpistemicBadge kind="interpretation" /> {degraded}
          </span>
        ) : null}
        {error ? <span className="text-xs text-red-600">{error}</span> : null}
      </div>

      {ideas.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {ideas.map((idea) => (
            <Card key={idea.id} className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Badge tone="low">{idea.category}</Badge>
                <label className="flex items-center gap-1.5 text-xs text-ink-500">
                  <input
                    type="checkbox"
                    checked={idea.selected === 1}
                    onChange={(e) => toggleSelect(idea.id, e.target.checked)}
                  />
                  picked
                </label>
              </div>
              <div className="text-sm font-semibold text-ink-900">{idea.title}</div>
              <div className="text-sm text-brand-700">“{idea.hook}”</div>
              <div className="space-y-1 text-xs text-ink-500">
                <div>Format: {idea.format}</div>
                <div>Pain: {idea.pain_point}</div>
                <div>Angle: {idea.emotional_angle}</div>
                <div>Value: {idea.value}</div>
                <div>CTA: {idea.cta}</div>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <button className="btn-ghost" onClick={() => getHooks(idea.id)} disabled={busy === `hooks-${idea.id}`}>
                  {busy === `hooks-${idea.id}` ? "…" : "Hooks"}
                </button>
                <button className="btn-ghost" onClick={() => makeScript(idea.id, 30)} disabled={busy === `script-${idea.id}`}>
                  {busy === `script-${idea.id}` ? "…" : "Script 30s"}
                </button>
                <button className="btn-ghost" onClick={() => schedule(idea)} disabled={busy === `cal-${idea.id}`}>
                  Schedule
                </button>
              </div>
            </Card>
          ))}
        </div>
      ) : null}

      {hooks ? (
        <Card className="space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-ink-900">Hook options</h3>
            <EpistemicBadge kind="interpretation" />
          </div>
          <ul className="space-y-1.5">
            {hooks.map((h, i) => (
              <li key={i} className="text-sm text-ink-700">
                <span className="mr-2 text-xs text-ink-400">[{h.style}]</span>
                {h.text}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {scriptView ? (
        <Card className="space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-ink-900">Script draft</h3>
            <EpistemicBadge kind="interpretation" />
            <Badge tone="new">draft — not published</Badge>
          </div>
          <pre className="max-h-72 overflow-auto rounded-lg bg-ink-950 p-3 text-xs text-ink-100">
            {JSON.stringify(scriptView, null, 2)}
          </pre>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-2">
          <h3 className="text-sm font-semibold text-ink-900">Generated scripts</h3>
          {scripts.length === 0 ? (
            <p className="text-sm text-ink-500">No scripts yet — pick an idea and generate one.</p>
          ) : (
            <ul className="divide-y divide-ink-100">
              {scripts.map((sc) => (
                <li key={sc.id} className="py-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-ink-800">{sc.hook || "Untitled"}</span>
                    <Badge tone="low">v{sc.version}</Badge>
                  </div>
                  <div className="mt-0.5 text-xs text-ink-400">
                    {sc.duration_sec}s · {sc.created_at.slice(0, 10)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="space-y-2">
          <h3 className="text-sm font-semibold text-ink-900">Scheduled (drafts)</h3>
          {calendar.length === 0 ? (
            <p className="text-sm text-ink-500">Nothing scheduled. Scheduling keeps items as drafts until you publish them from a connected account.</p>
          ) : (
            <ul className="divide-y divide-ink-100">
              {calendar.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <span className="truncate text-ink-800">{c.topic}</span>
                  <span className="flex items-center gap-2">
                    <Badge tone={c.status === "published" ? "completed" : "new"}>{c.status}</Badge>
                    <span className="text-xs text-ink-400">{c.publish_at.slice(0, 10)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
