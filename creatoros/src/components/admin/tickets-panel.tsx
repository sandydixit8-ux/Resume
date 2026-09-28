"use client";

import { useState } from "react";

interface Ticket {
  id: string;
  subject: string;
  body: string;
  status: string;
  created_at: string;
  email?: string;
}

export function TicketsPanel({ initial, statuses }: { initial: Ticket[]; statuses: string[] }) {
  const [tickets, setTickets] = useState(initial);

  async function setStatus(t: Ticket, status: string) {
    if (status === t.status) return;
    const res = await fetch(`/api/admin/tickets/${t.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      const json = await res.json();
      if (json.ok) {
        setTickets((prev) => prev.filter((x) => x.id !== t.id));
      }
    }
  }

  return (
    <div className="space-y-2">
      {tickets.length === 0 && <div className="card p-6 text-center text-sm text-navy-500">No open tickets.</div>}
      {tickets.map((t) => (
        <div key={t.id} className="card p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-navy-900">{t.subject}</div>
              <div className="mt-0.5 text-xs text-navy-400">{t.email ?? "unknown"} · {new Date(t.created_at).toLocaleString()}</div>
            </div>
            <select value={t.status} onChange={(e) => setStatus(t, e.target.value)} className="input !w-32 !py-1.5 text-sm capitalize">
              {statuses.map((st) => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>
          {t.body && <p className="mt-2 text-sm text-navy-600">{t.body}</p>}
        </div>
      ))}
    </div>
  );
}