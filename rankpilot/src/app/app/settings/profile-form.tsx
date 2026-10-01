"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";
import { Card, Badge } from "@/components/ui";

export function ProfileForm({ name, email, role }: { name: string; email: string; role: string }) {
  const router = useRouter();
  const [value, setValue] = useState(name);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setMsg(null);
    const res = await api("/api/auth/me", { method: "PATCH", json: { name: value } });
    setBusy(false);
    setMsg(res.ok ? "Saved." : res.error.message);
    if (res.ok) router.refresh();
  }

  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-ink-900">Profile</h2>
        <Badge tone="low">{role}</Badge>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="label">
          Display name
          <input className="input" value={value} onChange={(e) => setValue(e.target.value)} />
        </label>
        <label className="label">
          Email
          <input className="input" value={email} disabled />
        </label>
      </div>
      <div className="flex items-center gap-2">
        <button className="btn-primary" onClick={save} disabled={busy || !value.trim()}>
          {busy ? "Saving…" : "Save changes"}
        </button>
        {msg ? <span className="text-xs text-ink-500">{msg}</span> : null}
      </div>
    </Card>
  );
}
