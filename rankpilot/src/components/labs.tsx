"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";
import { Badge } from "@/components/ui";
import { EpistemicBadge } from "@/components/growth";

export type Schedule = {
  id: string;
  frequency: string;
  enabled: number;
  next_run_at: string | null;
  last_run_at: string | null;
} | null;

const FREQS = [
  { value: "", label: "No schedule" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

export function ScheduleControl({ websiteId, initial }: { websiteId: string; initial: Schedule }) {
  const router = useRouter();
  const [value, setValue] = useState(initial?.enabled ? initial.frequency : "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save(next: string) {
    setBusy(true);
    setMsg(null);
    const res = await api("/api/schedules", { method: "PUT", json: { websiteId, frequency: next || null } });
    setBusy(false);
    if (!res.ok) return setMsg(res.error.message);
    setMsg(next ? `Scheduled: ${next}. The worker enqueues a crawl at each due time.` : "Schedule cleared.");
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="input w-auto"
          value={value}
          disabled={busy}
          onChange={(e) => {
            setValue(e.target.value);
            void save(e.target.value);
          }}
        >
          {FREQS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        {initial?.enabled ? (
          <span className="text-xs text-ink-500">
            next: {initial.next_run_at ? new Date(initial.next_run_at).toLocaleString() : "—"}
            {initial.last_run_at ? ` · last: ${new Date(initial.last_run_at).toLocaleString()}` : ""}
          </span>
        ) : (
          <span className="text-xs text-ink-400">Crawls only run when you trigger them.</span>
        )}
      </div>
      {msg ? <p className="text-xs text-ink-500">{msg}</p> : null}
    </div>
  );
}

export function KeywordEnrich({ websiteId }: { websiteId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function enrich() {
    setBusy(true);
    const res = await api<{ note: string; status: string }>("/api/keywords/enrich", {
      method: "POST",
      json: { websiteId, limit: 20 },
    });
    setBusy(false);
    setNote(res.ok ? `${res.data.status}: ${res.data.note}` : res.error.message);
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <button className="btn-secondary" onClick={enrich} disabled={busy}>
        {busy ? "Checking provider…" : "Enrich volumes & difficulty"}
      </button>
      {note ? <p className="text-xs text-ink-500">{note}</p> : null}
      <p className="text-xs text-ink-400">
        Volume and difficulty are fetched from the connected provider. Without one, keywords stay “Data unavailable”.
      </p>
    </div>
  );
}

type Experiment = { id: string; name: string; hypothesis: string; metric: string; status: string; created_at: string };
type Variant = { id: string; experiment_id: string; label: string; traffic_pct: number; result_value: number | null };

const EXP_STATUSES = ["draft", "running", "paused", "concluded"] as const;

export function ExperimentLab({
  websiteId,
  initial,
  initialVariants,
}: {
  websiteId: string;
  initial: Experiment[];
  initialVariants: Variant[];
}) {
  const router = useRouter();
  const [f, setF] = useState({ name: "", hypothesis: "", metric: "ctr", a: "", b: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setError(null);
    const res = await api("/api/experiments", {
      method: "POST",
      json: {
        websiteId,
        name: f.name,
        hypothesis: f.hypothesis,
        metric: f.metric,
        variants: [
          { label: f.a || "A", trafficPct: 50 },
          { label: f.b || "B", trafficPct: 50 },
        ],
      },
    });
    setBusy(false);
    if (!res.ok) return setError(res.error.message);
    setF({ name: "", hypothesis: "", metric: "ctr", a: "", b: "" });
    router.refresh();
  }

  async function setStatus(id: string, status: string) {
    await api("/api/experiments", { method: "PATCH", json: { id, status } });
    router.refresh();
  }

  async function recordResult(variantId: string, raw: string) {
    const value = raw.trim() === "" ? null : Number(raw);
    if (value !== null && Number.isNaN(value)) return;
    await api("/api/experiments", { method: "PATCH", json: { variantId, resultValue: value } });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <label className="label mb-0">
          Name
          <input className="input w-52" value={f.name} placeholder="Title tag test" onChange={(e) => setF({ ...f, name: e.target.value })} />
        </label>
        <label className="label mb-0">
          Metric
          <select className="input w-auto" value={f.metric} onChange={(e) => setF({ ...f, metric: e.target.value })}>
            <option value="ctr">CTR</option>
            <option value="rank">Rank</option>
            <option value="clicks">Clicks</option>
            <option value="conversions">Conversions</option>
          </select>
        </label>
        <label className="label mb-0">
          Variant A
          <input className="input w-36" value={f.a} placeholder="Current" onChange={(e) => setF({ ...f, a: e.target.value })} />
        </label>
        <label className="label mb-0">
          Variant B
          <input className="input w-36" value={f.b} placeholder="New" onChange={(e) => setF({ ...f, b: e.target.value })} />
        </label>
        <button className="btn-primary" onClick={create} disabled={busy || !f.name.trim()}>
          {busy ? "Creating…" : "Create experiment"}
        </button>
      </div>
      <label className="label">
        Hypothesis (optional)
        <input className="input" value={f.hypothesis} placeholder="Why should this change work?" onChange={(e) => setF({ ...f, hypothesis: e.target.value })} />
      </label>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}

      {initial.length === 0 ? (
        <p className="text-sm text-ink-500">No experiments yet. Results are entered manually from your analytics — never guessed.</p>
      ) : (
        <ul className="space-y-3">
          {initial.map((e) => (
            <li key={e.id} className="rounded-xl border border-ink-200 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-ink-900">{e.name}</span>
                <Badge tone={e.status === "running" ? "active" : "low"}>{e.status}</Badge>
                <Badge tone="low">{e.metric}</Badge>
                <span className="ml-auto flex gap-1">
                  {EXP_STATUSES.filter((st) => st !== e.status).map((st) => (
                    <button key={st} className="btn-ghost" onClick={() => void setStatus(e.id, st)}>
                      {st}
                    </button>
                  ))}
                </span>
              </div>
              {e.hypothesis ? <p className="mt-1 text-xs text-ink-500">{e.hypothesis}</p> : null}
              <div className="mt-2 space-y-1">
                {initialVariants
                  .filter((v) => v.experiment_id === e.id)
                  .map((v) => (
                    <div key={v.id} className="flex items-center gap-2 text-xs">
                      <span className="w-32 truncate text-ink-700">{v.label}</span>
                      <span className="text-ink-400">{v.traffic_pct}% traffic</span>
                      <label className="ml-auto flex items-center gap-1 text-ink-500">
                        result:
                        <input
                          className="input w-20 py-1"
                          type="number"
                          defaultValue={v.result_value ?? ""}
                          placeholder="—"
                          onBlur={(ev) => void recordResult(v.id, ev.target.value)}
                        />
                      </label>
                      {v.result_value === null ? (
                        <span className="text-ink-400" title="Not recorded yet">
                          Data unavailable
                        </span>
                      ) : null}
                    </div>
                  ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type VisibilityRow = {
  id: string;
  engine: string;
  query: string;
  brand_mentioned: number | null;
  checked_at: string;
};

const ENGINES = ["general", "chatgpt", "perplexity", "gemini", "copilot"];

export function VisibilityPanel({ websiteId, initial }: { websiteId: string; initial: VisibilityRow[] }) {
  const router = useRouter();
  const [f, setF] = useState({ engine: "general", query: "" });
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function add() {
    setBusy(true);
    const res = await api<{ status: string; note: string }>("/api/visibility", {
      method: "POST",
      json: { websiteId, engine: f.engine, query: f.query },
    });
    setBusy(false);
    setNote(res.ok ? res.data.note : res.error.message);
    if (res.ok) setF({ ...f, query: "" });
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select className="input w-auto" value={f.engine} onChange={(e) => setF({ ...f, engine: e.target.value })}>
          {ENGINES.map((e) => (
            <option key={e}>{e}</option>
          ))}
        </select>
        <input
          className="input w-72"
          value={f.query}
          placeholder="Prompt your customers would ask an AI"
          onChange={(e) => setF({ ...f, query: e.target.value })}
        />
        <button className="btn-secondary" onClick={add} disabled={busy || f.query.trim().length < 2}>
          {busy ? "Recording…" : "Track query"}
        </button>
      </div>
      {note ? <p className="text-xs text-ink-500">{note}</p> : null}

      {initial.length === 0 ? (
        <p className="text-sm text-ink-500">No queries tracked yet.</p>
      ) : (
        <ul className="divide-y divide-ink-100">
          {initial.map((r) => (
            <li key={r.id} className="flex items-center gap-3 py-2 text-sm">
              <Badge tone="low">{r.engine}</Badge>
              <span className="min-w-0 flex-1 truncate text-ink-800">{r.query}</span>
              <span className="text-xs">
                {r.brand_mentioned === null ? (
                  <span className="text-ink-400">unmeasured — Data unavailable</span>
                ) : r.brand_mentioned ? (
                  <span className="text-green-700">mentioned</span>
                ) : (
                  <span className="text-red-600">not mentioned</span>
                )}
              </span>
              <span className="text-xs text-ink-400">{r.checked_at.slice(0, 10)}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center gap-2 text-xs text-ink-400">
        <EpistemicBadge kind="observed" />
        Queries are recorded immediately; mention results require an AI-search integration.
      </div>
    </div>
  );
}

type CmsFix = {
  id: string;
  issue_id: string | null;
  provider: string;
  status: string;
  error: string | null;
  backup_ref: string | null;
  created_at: string;
};

export function CmsFixPanel({ websiteId, initial }: { websiteId: string; initial: CmsFix[] }) {
  const router = useRouter();
  const [f, setF] = useState({ provider: "manual", title: "" });
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function propose() {
    setBusy(true);
    const res = await api<{ status: string; note: string }>("/api/cms-fixes", {
      method: "POST",
      json: { websiteId, provider: f.provider, payload: { title: f.title } },
    });
    setBusy(false);
    setNote(res.ok ? res.data.note : res.error.message);
    if (res.ok) setF({ ...f, title: "" });
    router.refresh();
  }

  async function act(id: string, action: "apply" | "verify" | "discard") {
    const res = await api<{ status: string; error?: string }>("/api/cms-fixes", {
      method: "PATCH",
      json: { id, action },
    });
    setNote(res.ok ? `${action}: ${res.data.status}${res.data.error ? ` — ${res.data.error}` : ""}` : res.error.message);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="label mb-0">
          Provider
          <select className="input w-auto" value={f.provider} onChange={(e) => setF({ ...f, provider: e.target.value })}>
            <option value="manual">manual</option>
            <option value="wordpress">wordpress</option>
            <option value="shopify">shopify</option>
            <option value="webflow">webflow</option>
            <option value="wix">wix</option>
          </select>
        </label>
        <label className="label mb-0">
          Change
          <input className="input w-72" value={f.title} placeholder="e.g. Set meta title on /pricing" onChange={(e) => setF({ ...f, title: e.target.value })} />
        </label>
        <button className="btn-secondary" onClick={propose} disabled={busy || f.title.trim().length < 3}>
          {busy ? "Staging…" : "Stage fix"}
        </button>
      </div>
      {note ? <p className="text-xs text-ink-500">{note}</p> : null}

      {initial.length === 0 ? (
        <p className="text-sm text-ink-500">No fixes staged. Staging never changes your site — applying needs a connected CMS.</p>
      ) : (
        <ul className="divide-y divide-ink-100">
          {initial.map((x) => (
            <li key={x.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
              <Badge tone={x.status === "blocked" ? "high" : x.status === "verified" ? "approved" : "low"}>{x.status}</Badge>
              <span className="text-ink-700">{x.provider}</span>
              <span className="min-w-0 flex-1 truncate text-xs text-ink-500">
                {x.error ?? `backup: ${x.backup_ref ?? "—"}`}
              </span>
              <span className="flex gap-1">
                {x.status === "proposed" ? (
                  <>
                    <button className="btn-ghost" onClick={() => void act(x.id, "apply")}>
                      apply
                    </button>
                    <button className="btn-ghost" onClick={() => void act(x.id, "discard")}>
                      discard
                    </button>
                  </>
                ) : null}
                {x.status === "applied" ? (
                  <button className="btn-ghost" onClick={() => void act(x.id, "verify")}>
                    verify
                  </button>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function DnaCard({ stats }: { stats: Record<string, number | null> }) {
  const entries = Object.entries(stats);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {entries.map(([k, v]) => (
        <div key={k} className="rounded-xl border border-ink-200 p-3">
          <div className="text-xs capitalize text-ink-400">{k.replace(/([A-Z])/g, " $1")}</div>
          <div className="mt-0.5 text-lg font-semibold text-ink-900">
            {v === null ? <span className="text-sm font-normal text-ink-400">Data unavailable</span> : v}
          </div>
        </div>
      ))}
    </div>
  );
}
