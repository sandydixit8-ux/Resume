"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { Crown, Loader2, Plus } from "lucide-react";

export interface TemplateCardData {
  id: string;
  name: string;
  category: string;
  description: string;
  premium: boolean;
  theme: { accent: string; bg: string; radius: string };
}

export function TemplateCard({ template, locked }: { template: TemplateCardData; locked: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function apply() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/templates/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: template.id }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error?.message || "Could not apply template");
        setLoading(false);
        return;
      }
      router.push(`/app/bio/${json.data.pageId}`);
    } catch {
      setError("Network error");
      setLoading(false);
    }
  }

  return (
    <div className="card flex flex-col gap-3 p-5">
      <div className="flex items-start justify-between gap-2">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-lg font-bold text-white"
          style={{ backgroundColor: template.theme.accent, borderRadius: Number(template.theme.radius) || 12 }}
        >
          {template.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="flex flex-col items-end gap-1">
          {template.premium && (
            <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
              <Crown className="h-3 w-3" /> Premium
            </span>
          )}
          <span className="rounded-full bg-navy-50 px-2 py-0.5 text-xs font-medium capitalize text-navy-500">{template.category}</span>
        </div>
      </div>
      <div>
        <h3 className="font-semibold text-navy-900">{template.name}</h3>
        <p className="mt-1 text-sm text-navy-500">{template.description}</p>
      </div>
      <div className="mt-auto flex flex-col items-start gap-1">
        {locked ? (
          <Link href="/app/billing" className="btn-secondary w-full">
            Upgrade to use
          </Link>
        ) : (
          <button type="button" onClick={apply} disabled={loading} className="btn-primary w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Start from template
          </button>
        )}
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    </div>
  );
}