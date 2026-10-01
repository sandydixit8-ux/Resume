"use client";

import { useState } from "react";
import { cn } from "@/components/ui";
import { api } from "@/lib/client";

/** Epistemic labels required by docs/07: Observed data / AI interpretation / Recommendation. */
export function EpistemicBadge({ kind }: { kind: "observed" | "interpretation" | "recommendation" }) {
  const map = {
    observed: { label: "Observed data", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    interpretation: { label: "AI interpretation", cls: "bg-violet-50 text-violet-700 border-violet-200" },
    recommendation: { label: "Recommendation", cls: "bg-brand-50 text-brand-700 border-brand-200" },
  } as const;
  const m = map[kind];
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium", m.cls)}>
      {m.label}
    </span>
  );
}

export function DataUnavailable({ reason }: { reason?: string }) {
  return (
    <span className="text-ink-400 italic" title={reason ?? "No observed data for this metric."}>
      Data unavailable
    </span>
  );
}

export type DiffRow = { field: string; before: string; after: string; why: string };

/** BEFORE/AFTER change table used by Content Studio and issue fixes. */
export function DiffView({ changes }: { changes: DiffRow[] }) {
  if (!changes.length) {
    return <p className="text-sm text-ink-500">No field-level changes recorded for this draft.</p>;
  }
  return (
    <div className="overflow-hidden rounded-xl border border-ink-200">
      <table className="w-full text-sm">
        <thead className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-500">
          <tr>
            <th className="px-3 py-2 font-medium">Field</th>
            <th className="px-3 py-2 font-medium">Before</th>
            <th className="px-3 py-2 font-medium">After</th>
            <th className="px-3 py-2 font-medium">Why</th>
          </tr>
        </thead>
        <tbody>
          {changes.map((c, i) => (
            <tr key={i} className="border-t border-ink-100 align-top">
              <td className="px-3 py-2 font-medium text-ink-700">{c.field}</td>
              <td className="max-w-[16rem] px-3 py-2">
                <span className="block rounded bg-red-50 px-2 py-1 text-red-800 line-through decoration-red-300">
                  {c.before || "—"}
                </span>
              </td>
              <td className="max-w-[16rem] px-3 py-2">
                <span className="block rounded bg-emerald-50 px-2 py-1 text-emerald-800">{c.after || "—"}</span>
              </td>
              <td className="max-w-[16rem] px-3 py-2 text-ink-600">{c.why}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** AI output is never live without explicit human approval. */
export function ApprovalBar({
  status,
  onApprove,
  onDiscard,
  busy,
}: {
  status: "draft" | "approved" | "rejected";
  onApprove: () => void;
  onDiscard: () => void;
  busy?: boolean;
}) {
  if (status === "approved") {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        ✓ Approved by you — safe to publish or copy.
      </div>
    );
  }
  if (status === "rejected") {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-ink-200 bg-ink-50 px-4 py-3 text-sm text-ink-600">
        Discarded. Nothing was published.
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
      <span className="text-sm font-medium text-amber-800">
        Draft — approval required before anything goes live
      </span>
      <div className="ml-auto flex gap-2">
        <button className="btn-secondary" onClick={onDiscard} disabled={busy}>
          Discard
        </button>
        <button className="btn-primary" onClick={onApprove} disabled={busy}>
          {busy ? "Saving…" : "Approve"}
        </button>
      </div>
    </div>
  );
}

/** Reusable approve/discard helper wired to an API endpoint. */
export function useApproval(path: string, initial: "draft" | "approved" | "rejected" = "draft") {
  const [status, setStatus] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function decide(next: "approved" | "rejected") {
    setBusy(true);
    try {
      const res = await api(path, { method: "PATCH", json: { status: next } });
      if (res.ok) setStatus(next);
    } finally {
      setBusy(false);
    }
  }

  return { status, busy, approve: () => decide("approved"), discard: () => decide("rejected") };
}
