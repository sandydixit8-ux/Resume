"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";

const PLATFORMS = ["linkedin", "x", "instagram", "tiktok", "youtube", "facebook"] as const;

export function NewCampaignButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState({ name: "", platform: "linkedin", audience: "", objective: "", goal: "" });

  async function go() {
    setBusy(true);
    setError(null);
    const res = await api<{ id: string }>("/api/social/campaigns", { method: "POST", json: f });
    setBusy(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    router.push(`/app/social/campaigns/${res.data.id}`);
  }

  if (!open) {
    return (
      <button className="btn-primary" onClick={() => setOpen(true)}>
        New campaign
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-900/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-soft">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink-900">New campaign</h2>
          <button className="btn-ghost" onClick={() => setOpen(false)}>✕</button>
        </div>
        <div className="space-y-3">
          <label className="label">
            Name *
            <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="label">
              Platform
              <select className="input" value={f.platform} onChange={(e) => setF({ ...f, platform: e.target.value })}>
                {PLATFORMS.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
            <label className="label">
              Audience
              <input className="input" value={f.audience} placeholder="e.g. B2B marketers" onChange={(e) => setF({ ...f, audience: e.target.value })} />
            </label>
          </div>
          <label className="label">
            Objective
            <input className="input" value={f.objective} placeholder="e.g. build awareness for SEO tooling" onChange={(e) => setF({ ...f, objective: e.target.value })} />
          </label>
          <label className="label">
            Goal (observable, not a guarantee)
            <input className="input" value={f.goal} placeholder="e.g. start conversations with founders" onChange={(e) => setF({ ...f, goal: e.target.value })} />
          </label>
        </div>
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
          <button className="btn-primary" onClick={go} disabled={busy || !f.name.trim()}>
            {busy ? "Creating…" : "Create campaign"}
          </button>
        </div>
      </div>
    </div>
  );
}
