"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";
import { Badge, Card } from "@/components/ui";
import { EpistemicBadge } from "@/components/growth";

type Event = { id: string; source: string; label: string; amount_usd: number; occurred_at: string };

const SOURCES = ["organic", "ai_search", "social", "referral", "email", "direct", "manual"];

export function RevenuePanel({
  initial,
  totalUsd,
  websites,
}: {
  initial: Event[];
  totalUsd: number;
  websites: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [f, setF] = useState({ source: "manual", label: "", amountUsd: "", occurredAt: new Date().toISOString().slice(0, 10), websiteId: websites[0]?.id ?? "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    setBusy(true);
    setError(null);
    const res = await api("/api/revenue", {
      method: "POST",
      json: {
        source: f.source,
        label: f.label,
        amountUsd: Number(f.amountUsd),
        occurredAt: f.occurredAt,
        websiteId: f.websiteId || null,
      },
    });
    setBusy(false);
    if (!res.ok) return setError(res.error.message);
    setF({ ...f, label: "", amountUsd: "" });
    router.refresh();
  }

  async function remove(id: string) {
    const res = await api("/api/revenue", { method: "DELETE", json: { id } });
    if (res.ok) router.refresh();
  }

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-ink-400">Attributed total</div>
          <div className="text-xl font-semibold text-ink-900">${totalUsd.toFixed(2)}</div>
        </div>
        <EpistemicBadge kind="observed" />
        <span className="text-xs text-ink-400">Manually recorded events — never auto-estimated.</span>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="label mb-0">
          Source
          <select className="input w-auto" value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })}>
            {SOURCES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="label mb-0">
          Label
          <input className="input w-52" value={f.label} placeholder="e.g. Annual plan — Acme" onChange={(e) => setF({ ...f, label: e.target.value })} />
        </label>
        <label className="label mb-0">
          Amount (USD)
          <input className="input w-28" type="number" min="0" value={f.amountUsd} onChange={(e) => setF({ ...f, amountUsd: e.target.value })} />
        </label>
        <label className="label mb-0">
          Date
          <input className="input w-36" type="date" value={f.occurredAt} onChange={(e) => setF({ ...f, occurredAt: e.target.value })} />
        </label>
        <label className="label mb-0">
          Website
          <select className="input w-auto" value={f.websiteId} onChange={(e) => setF({ ...f, websiteId: e.target.value })}>
            <option value="">(none)</option>
            {websites.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </label>
        <button className="btn-primary" onClick={add} disabled={busy || !f.label.trim() || !f.amountUsd}>
          {busy ? "Adding…" : "Add event"}
        </button>
      </div>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}

      {initial.length === 0 ? (
        <p className="text-sm text-ink-500">No revenue events recorded yet.</p>
      ) : (
        <ul className="divide-y divide-ink-100">
          {initial.map((e) => (
            <li key={e.id} className="flex items-center gap-3 py-2 text-sm">
              <Badge tone="low">{e.source}</Badge>
              <span className="min-w-0 flex-1 truncate text-ink-800">{e.label}</span>
              <span className="text-ink-600">${e.amount_usd.toFixed(2)}</span>
              <span className="text-xs text-ink-400">{e.occurred_at.slice(0, 10)}</span>
              <button className="btn-ghost" onClick={() => void remove(e.id)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
