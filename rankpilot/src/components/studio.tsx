"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";

const TYPES = ["article", "landing", "faq", "comparison", "howto"] as const;
const INTENTS = ["informational", "commercial", "transactional", "navigational"];

export function NewDraftButton({ websites }: { websites: Array<{ id: string; name: string }> }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    websiteId: websites[0]?.id ?? "",
    title: "",
    goal: "",
    keyword: "",
    intent: "informational",
    tone: "professional",
    type: "article",
    cta: "",
  });

  async function submit() {
    setBusy(true);
    setError(null);
    const res = await api<{ contentId: string }>("/api/content", {
      method: "POST",
      json: { websiteId: form.websiteId, brief: { ...form, websiteId: undefined } },
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    router.push(`/app/studio/${res.data.contentId}`);
  }

  if (!open) {
    return (
      <button className="btn-primary" onClick={() => setOpen(true)}>
        New draft
      </button>
    );
  }

  const field = "input";
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-900/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-soft">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink-900">New draft</h2>
          <button className="btn-ghost" onClick={() => setOpen(false)}>
            ✕
          </button>
        </div>

        <div className="space-y-3">
          <label className="label">
            Website
            <select className={field} value={form.websiteId} onChange={(e) => setForm({ ...form, websiteId: e.target.value })}>
              {websites.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </label>
          <label className="label">
            Working title *
            <input
              className={field}
              value={form.title}
              placeholder="e.g. Best SEO tools for small teams"
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </label>
          <label className="label">
            Goal
            <input
              className={field}
              value={form.goal}
              placeholder="What should this piece achieve?"
              onChange={(e) => setForm({ ...form, goal: e.target.value })}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="label">
              Target keyword
              <input className={field} value={form.keyword} onChange={(e) => setForm({ ...form, keyword: e.target.value })} />
            </label>
            <label className="label">
              Intent
              <select className={field} value={form.intent} onChange={(e) => setForm({ ...form, intent: e.target.value })}>
                {INTENTS.map((i) => (
                  <option key={i}>{i}</option>
                ))}
              </select>
            </label>
            <label className="label">
              Type
              <select className={field} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label className="label">
              Tone
              <input className={field} value={form.tone} onChange={(e) => setForm({ ...form, tone: e.target.value })} />
            </label>
          </div>
          <label className="label">
            Call to action
            <input className={field} value={form.cta} onChange={(e) => setForm({ ...form, cta: e.target.value })} />
          </label>
        </div>

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-secondary" onClick={() => setOpen(false)}>
            Cancel
          </button>
          <button className="btn-primary" onClick={submit} disabled={busy || !form.title.trim()}>
            {busy ? "Generating…" : "Generate draft"}
          </button>
        </div>
        <p className="mt-3 text-xs text-ink-400">
          Drafts are stored for review only. AI output is never published automatically.
        </p>
      </div>
    </div>
  );
}
