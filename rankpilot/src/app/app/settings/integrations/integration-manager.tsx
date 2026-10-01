"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";

export function IntegrationManager({ provider, label, status }: { provider: string; label: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setBusy(true);
    setError(null);
    const next = status === "connected" ? "disconnected" : "connected";
    const res = await api("/api/integrations", { method: "POST", json: { provider, status: next } });
    setBusy(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    router.refresh();
  }

  const connected = status === "connected";
  return (
    <div className="flex items-center gap-2 pt-1">
      <button className={connected ? "btn-ghost" : "btn-secondary"} onClick={toggle} disabled={busy}>
        {busy ? "Working…" : connected ? `Disconnect ${label}` : `Connect ${label}`}
      </button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
