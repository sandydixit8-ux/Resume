"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";
import { Card, Badge } from "@/components/ui";

type Branding = {
  brandName: string;
  primaryColor: string;
  accentColor: string;
  logoUrl: string;
  emailFooter: string;
  hideRankPilotBranding: boolean;
};

export function BrandingForm({ initial, plan }: { initial: Branding; plan: string }) {
  const router = useRouter();
  const [f, setF] = useState<Branding>(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const canHide = plan === "growth" || plan === "agency";

  async function save() {
    setBusy(true);
    setMsg(null);
    const res = await api("/api/settings/branding", { method: "PUT", json: f });
    setBusy(false);
    setMsg(res.ok ? "Saved." : res.error.message);
    if (res.ok) router.refresh();
  }

  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-ink-900">Branding</h2>
        <Badge tone={plan === "free" ? "low" : "new"}>{plan} plan</Badge>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="label">
          Brand name
          <input className="input" value={f.brandName} onChange={(e) => setF({ ...f, brandName: e.target.value })} />
        </label>
        <label className="label">
          Logo URL
          <input className="input" value={f.logoUrl} placeholder="https://…" onChange={(e) => setF({ ...f, logoUrl: e.target.value })} />
        </label>
        <label className="label">
          Primary color
          <input className="input" type="color" value={f.primaryColor} onChange={(e) => setF({ ...f, primaryColor: e.target.value })} />
        </label>
        <label className="label">
          Accent color
          <input className="input" type="color" value={f.accentColor} onChange={(e) => setF({ ...f, accentColor: e.target.value })} />
        </label>
      </div>
      <label className="label">
        Report footer
        <input className="input" value={f.emailFooter} onChange={(e) => setF({ ...f, emailFooter: e.target.value })} />
      </label>
      <label className="flex items-center gap-2 text-sm text-ink-700">
        <input
          type="checkbox"
          checked={f.hideRankPilotBranding}
          disabled={!canHide}
          onChange={(e) => setF({ ...f, hideRankPilotBranding: e.target.checked })}
        />
        Hide RankPilot branding
        {!canHide ? <span className="text-xs text-ink-400">(growth/agency plan)</span> : null}
      </label>
      <div className="flex items-center gap-2">
        <button className="btn-primary" onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save branding"}
        </button>
        {msg ? <span className="text-xs text-ink-500">{msg}</span> : null}
      </div>
    </Card>
  );
}
