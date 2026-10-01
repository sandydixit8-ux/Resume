"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";

export function ChangePlan({ current }: { current: string }) {
  const router = useRouter();
  const [plan, setPlan] = useState(current);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function apply() {
    setBusy(true);
    setMsg(null);
    const res = await api("/api/billing", { method: "PATCH", json: { plan } });
    setBusy(false);
    if (!res.ok) {
      setMsg(res.error.message);
      return;
    }
    setMsg("Plan updated.");
    router.refresh();
  }

  return (
    <div className="flex items-end gap-2">
      <label className="label mb-0">
        Switch plan
        <select className="input w-auto" value={plan} onChange={(e) => setPlan(e.target.value)}>
          {["free", "pro", "growth", "agency"].map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </label>
      <button className="btn-primary" onClick={apply} disabled={busy || plan === current}>
        {busy ? "Applying…" : "Apply"}
      </button>
      {msg ? <span className="text-xs text-ink-500">{msg}</span> : null}
    </div>
  );
}
