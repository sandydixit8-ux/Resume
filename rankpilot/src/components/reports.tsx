"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";

const TYPES = ["growth", "issues", "content", "social", "usage"] as const;
const FORMATS = ["json", "csv", "pdf"] as const;

export function ReportGenerator({ websites }: { websites: Array<{ id: string; name: string }> }) {
  const router = useRouter();
  const [websiteId, setWebsiteId] = useState(websites[0]?.id ?? "");
  const [type, setType] = useState<(typeof TYPES)[number]>("growth");
  const [format, setFormat] = useState<(typeof FORMATS)[number]>("json");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setError(null);
    setDone(null);
    const res = await api<{ id: string }>("/api/reports", {
      method: "POST",
      json: { websiteId, type, format },
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    setDone(res.data.id);
    router.refresh();
  }

  if (websites.length === 0) {
    return <p className="text-sm text-ink-500">Add a website to generate reports.</p>;
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="label mb-0">
        Website
        <select className="input w-auto" value={websiteId} onChange={(e) => setWebsiteId(e.target.value)}>
          {websites.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
      </label>
      <label className="label mb-0">
        Type
        <select className="input w-auto" value={type} onChange={(e) => setType(e.target.value as (typeof TYPES)[number])}>
          {TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </label>
      <label className="label mb-0">
        Format
        <select className="input w-auto" value={format} onChange={(e) => setFormat(e.target.value as (typeof FORMATS)[number])}>
          {FORMATS.map((f) => (
            <option key={f}>{f}</option>
          ))}
        </select>
      </label>
      <button className="btn-primary" onClick={go} disabled={busy}>
        {busy ? "Generating…" : "Generate"}
      </button>
      {done ? <span className="text-xs text-emerald-600">Ready ✓</span> : null}
      {error ? <span className="w-full text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
