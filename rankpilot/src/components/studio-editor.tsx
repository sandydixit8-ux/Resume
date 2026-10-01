"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";
import { ApprovalBar, DiffView, EpistemicBadge, type DiffRow } from "@/components/growth";

type OptimizeResult = {
  analysis: string;
  changes: DiffRow[];
  rewritten: string;
  source: string;
  degraded?: string | null;
};

export function Editor({
  contentId,
  websiteId,
  initialTitle,
  initialBody,
  status: initialStatus,
}: {
  contentId: string;
  websiteId: string;
  initialTitle: string;
  initialBody: string;
  status: "draft" | "review" | "approved" | "published" | "rejected";
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState(initialBody);
  const [status, setStatus] = useState<"draft" | "approved" | "rejected">(
    initialStatus === "approved" || initialStatus === "published" ? "approved" : initialStatus === "rejected" ? "rejected" : "draft"
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opt, setOpt] = useState<OptimizeResult | null>(null);

  async function save(next?: { title?: string; body?: string; status?: string }) {
    setBusy(true);
    setError(null);
    const res = await api(`/api/content/${contentId}`, {
      method: "PATCH",
      json: { title: next?.title ?? title, body: next?.body ?? body, status: next?.status },
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error.message);
      return false;
    }
    return true;
  }

  async function optimize() {
    if (websiteId) {
      const saved = await save();
      if (!saved) return;
    }
    setBusy(true);
    setError(null);
    const res = await api<OptimizeResult>(`/api/content/${contentId}`, { method: "POST", json: {} });
    setBusy(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    setOpt(res.data);
    router.refresh();
  }

  async function applyOptimized() {
    if (!opt) return;
    const saved = await save({ body: opt.rewritten, status: "draft" });
    if (saved) {
      setBody(opt.rewritten);
      setStatus("draft");
      router.refresh();
    }
  }

  async function approve() {
    const saved = await save({ status: "approved" });
    if (saved) setStatus("approved");
  }

  async function discard() {
    const saved = await save({ status: "rejected" });
    if (saved) setStatus("rejected");
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="input flex-1"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-label="Draft title"
        />
        <button className="btn-secondary" onClick={() => void save()} disabled={busy}>
          {busy ? "Working…" : "Save draft"}
        </button>
        <button className="btn-primary" onClick={optimize} disabled={busy || !websiteId}>
          {busy ? "Optimizing…" : "Optimize with AI"}
        </button>
      </div>

      <textarea
        className="input min-h-[22rem] font-mono text-sm"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        aria-label="Draft body"
      />

      <ApprovalBar status={status} onApprove={approve} onDiscard={discard} busy={busy} />

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {opt ? (
        <div className="space-y-3 rounded-xl border border-ink-200 bg-white p-4">
          <div className="flex flex-wrap items-center gap-2">
            <EpistemicBadge kind="interpretation" />
            <span className="text-xs text-ink-500">
              analysis · source: {opt.source}
              {opt.degraded ? ` · ${opt.degraded}` : ""}
            </span>
            <button className="btn-secondary ml-auto" onClick={applyOptimized} disabled={busy}>
              Apply rewritten text
            </button>
          </div>
          <p className="text-sm text-ink-700">{opt.analysis}</p>
          <DiffView changes={opt.changes} />
        </div>
      ) : null}
    </div>
  );
}
