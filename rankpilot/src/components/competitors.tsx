"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";

export function AddCompetitorButton({ websiteId }: { websiteId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setError(null);
    const res = await api<{ score: number; gapsFound: number }>("/api/competitors", {
      method: "POST",
      json: { websiteId, url, name },
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    setOpen(false);
    setUrl("");
    setName("");
    router.refresh();
  }

  if (!open) {
    return (
      <button className="btn-primary" onClick={() => setOpen(true)}>
        Add competitor
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="label mb-0">
        URL
        <input className="input w-64" value={url} placeholder="https://competitor.com" onChange={(e) => setUrl(e.target.value)} />
      </label>
      <label className="label mb-0">
        Name
        <input className="input w-40" value={name} placeholder="Optional" onChange={(e) => setName(e.target.value)} />
      </label>
      <button className="btn-primary" onClick={go} disabled={busy || !url.trim()}>
        {busy ? "Auditing…" : "Audit"}
      </button>
      <button className="btn-ghost" onClick={() => setOpen(false)}>
        Cancel
      </button>
      {error ? <span className="w-full text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
