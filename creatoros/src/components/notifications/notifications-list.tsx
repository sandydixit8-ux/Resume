"use client";

import { useState } from "react";
import { Check, CheckCheck } from "lucide-react";

interface Notification {
  id: string;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
}

export function NotificationsList({ initial }: { initial: Notification[] }) {
  const [items, setItems] = useState(initial);

  async function markRead(id: string) {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
  }

  async function markAll() {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    await fetch("/api/notifications/read", { method: "PUT" });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button type="button" onClick={markAll} className="btn-secondary !px-3 !py-1.5 text-xs">
          <CheckCheck className="h-3.5 w-3.5" /> Mark all read
        </button>
      </div>
      {items.length === 0 ? (
        <div className="card p-10 text-center text-sm text-navy-500">Nothing here yet. Reactions, comments and new signups will show up.</div>
      ) : (
        <div className="space-y-2">
          {items.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => !n.read && markRead(n.id)}
              className={`card block w-full p-4 text-left transition-colors ${n.read ? "opacity-60" : "hover:border-brand-200"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {n.read ? (
                    <Check className="h-4 w-4 text-navy-300" />
                  ) : (
                    <span className="h-2 w-2 rounded-full bg-brand-500" />
                  )}
                  <span className={`text-sm font-semibold ${n.read ? "text-navy-600" : "text-navy-900"}`}>{n.title}</span>
                </div>
                <span className="shrink-0 text-xs text-navy-400">{new Date(n.created_at).toLocaleString()}</span>
              </div>
              {n.body && <p className="mt-1 pl-6 text-sm text-navy-500">{n.body}</p>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}