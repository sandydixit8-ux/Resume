"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";
import { EpistemicBadge } from "@/components/growth";

const FORMATS = ["linkedin", "x", "instagram", "newsletter", "script", "blog"] as const;

export function RepurposePanel({
  contentId,
  status,
}: {
  contentId: string;
  status: "draft" | "review" | "approved" | "published" | "rejected";
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(["linkedin"]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [created, setCreated] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  function toggle(format: string) {
    setSelected((s) => (s.includes(format) ? s.filter((x) => x !== format) : [...s, format]));
  }

  async function repurpose() {
    setBusy(true);
    setError(null);
    setNote(null);
    const res = await api<{ ids: string[]; source: string; degraded?: string | null; note: string }>("/api/content/repurpose", {
      method: "POST",
      json: { contentId, formats: selected },
    });
    setBusy(false);
    if (!res.ok) return setError(res.error.message);
    setCreated(res.data.ids);
    setNote(
      `${res.data.source === "rules" ? "Rules-generated draft" : "AI draft"}${res.data.degraded ? ` — ${res.data.degraded}` : ""}. ${res.data.note}`
    );
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {FORMATS.map((f) => (
          <label key={f} className="flex items-center gap-1.5 text-sm text-ink-700">
            <input type="checkbox" checked={selected.includes(f)} onChange={() => toggle(f)} />
            {f}
          </label>
        ))}
        <button
          className="btn-secondary ml-auto"
          onClick={repurpose}
          disabled={busy || selected.length === 0 || status !== "approved"}
          title={status !== "approved" ? "Approve the source before repurposing" : undefined}
        >
          {busy ? "Generating drafts…" : "Repurpose"}
        </button>
      </div>

      {status !== "approved" ? (
        <p className="text-xs text-ink-400">
          Repurposing is approval-gated: approve this draft first. Generated assets land as new drafts in the Studio.
        </p>
      ) : null}

      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      {note ? (
        <p className="flex flex-wrap items-center gap-2 text-xs text-ink-500">
          <EpistemicBadge kind="interpretation" />
          {note}
        </p>
      ) : null}
      {created.length > 0 ? (
        <ul className="space-y-1 text-sm">
          {created.map((id) => (
            <li key={id}>
              <a href={`/app/studio/${id}`} className="text-brand-700 hover:underline">
                Open new draft →
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
