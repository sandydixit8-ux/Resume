"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";

const TYPES = ["FAQPage", "Article", "HowTo", "Organization", "BreadcrumbList", "Product"] as const;

export function SchemaGenerator({
  websiteId,
  pages,
}: {
  websiteId: string;
  pages: Array<{ id: string; url: string; title: string | null }>;
}) {
  const router = useRouter();
  const [pageId, setPageId] = useState("");
  const [type, setType] = useState<(typeof TYPES)[number]>("Article");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [last, setLast] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setError(null);
    setLast(null);
    const res = await api<{ id: string; jsonLd: unknown }>("/api/schema", {
      method: "POST",
      json: { websiteId, pageId: pageId || undefined, type },
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    setLast(res.data.id);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="label mb-0">
        Page
        <select className="input w-auto" value={pageId} onChange={(e) => setPageId(e.target.value)}>
          <option value="">Site root (auto)</option>
          {pages.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title || p.url}
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
      <button className="btn-primary" onClick={go} disabled={busy}>
        {busy ? "Generating…" : "Generate JSON-LD"}
      </button>
      {last ? <span className="text-xs text-emerald-600">Draft created ✓</span> : null}
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
