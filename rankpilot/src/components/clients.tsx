"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";
import { Badge, Card } from "@/components/ui";

type Client = { id: string; name: string; contact: string; status: string; created_at: string; websites: number };
type Website = { id: string; name: string; client_id: string | null };

export function ClientsPanel({ clients, websites, mode }: { clients: Client[]; websites: Website[]; mode: string }) {
  const router = useRouter();
  const [f, setF] = useState({ name: "", contact: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setError(null);
    const res = await api("/api/clients", { method: "POST", json: { name: f.name, contact: f.contact } });
    setBusy(false);
    if (!res.ok) return setError(res.error.message);
    setF({ name: "", contact: "" });
    router.refresh();
  }

  async function assign(websiteId: string, clientId: string) {
    await api("/api/clients", { method: "PATCH", json: { websiteId, clientId: clientId || null } });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Badge tone={mode === "agency" ? "active" : "low"}>{mode} mode</Badge>
        <span className="text-xs text-ink-500">
          Agency mode activates when you add your first client. Clients group websites for client-facing reporting.
        </span>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="label mb-0">
          Client name
          <input className="input w-56" value={f.name} placeholder="Acme Co." onChange={(e) => setF({ ...f, name: e.target.value })} />
        </label>
        <label className="label mb-0">
          Contact
          <input className="input w-56" value={f.contact} placeholder="ops@acme.com" onChange={(e) => setF({ ...f, contact: e.target.value })} />
        </label>
        <button className="btn-primary" onClick={create} disabled={busy || f.name.trim().length < 2}>
          {busy ? "Adding…" : "Add client"}
        </button>
      </div>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}

      <Card className="space-y-3 p-5">
        <h2 className="text-sm font-semibold text-ink-900">Clients</h2>
        {clients.length === 0 ? (
          <p className="text-sm text-ink-500">No clients yet.</p>
        ) : (
          <ul className="divide-y divide-ink-100">
            {clients.map((c) => (
              <li key={c.id} className="flex items-center gap-3 py-2 text-sm">
                <span className="font-medium text-ink-800">{c.name}</span>
                <span className="text-xs text-ink-400">{c.contact || "no contact"}</span>
                <Badge tone="low">{c.websites} sites</Badge>
                <Badge tone={c.status === "active" ? "approved" : "low"}>{c.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="space-y-3 p-5">
        <h2 className="text-sm font-semibold text-ink-900">Website assignment</h2>
        {websites.length === 0 ? (
          <p className="text-sm text-ink-500">No websites yet.</p>
        ) : (
          <ul className="divide-y divide-ink-100">
            {websites.map((w) => (
              <li key={w.id} className="flex items-center gap-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate text-ink-800">{w.name}</span>
                <select
                  className="input w-auto"
                  value={w.client_id ?? ""}
                  onChange={(e) => void assign(w.id, e.target.value)}
                >
                  <option value="">(unassigned)</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
