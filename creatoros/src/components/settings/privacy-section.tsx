"use client";

import { useState } from "react";
import { Download, Loader2, Trash2, AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";

export function PrivacySection() {
  const router = useRouter();
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  async function deleteAccount(e: React.FormEvent) {
    e.preventDefault();
    if (confirm !== "DELETE") {
      setMsg({ type: "err", text: "Type DELETE to confirm" });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm }),
      });
      const j = await res.json();
      if (j.ok) {
        router.push("/auth/login?deleted=1");
      } else {
        setMsg({ type: "err", text: j.error?.message || "Could not delete account" });
        setBusy(false);
      }
    } catch {
      setMsg({ type: "err", text: "Network error" });
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="card p-6">
        <h2 className="mb-1 font-semibold text-navy-900">Export your data</h2>
        <p className="mb-4 text-sm text-navy-500">
          Download a copy of everything this account stores (GDPR data portability).
        </p>
        <a href="/api/account/export" className="btn-secondary inline-flex items-center gap-2">
          <Download className="h-4 w-4" />
          Export as JSON
        </a>
      </div>

      <div className="card border-red-200 p-6">
        <h2 className="mb-1 font-semibold text-red-700">Delete account</h2>
        <p className="mb-1 text-sm text-navy-500">
          Permanently deletes your organization and all associated data (leads, pages, courses, orders,
          bookings). This cannot be undone. Consider exporting first.
        </p>
        <form onSubmit={deleteAccount} className="mt-4 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          <input
            className="input max-w-[220px]"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Type DELETE"
            aria-label="Type DELETE to confirm"
          />
          <button
            type="submit"
            disabled={busy || confirm !== "DELETE"}
            className="btn-danger inline-flex items-center gap-2"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Delete account
          </button>
        </form>
        {msg && (
          <div
            className={`mt-3 flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${
              msg.type === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"
            }`}
          >
            {msg.type === "err" && <AlertTriangle className="h-4 w-4" />}
            {msg.text}
          </div>
        )}
      </div>
    </div>
  );
}