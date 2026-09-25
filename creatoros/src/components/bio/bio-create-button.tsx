"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus, Loader2 } from "lucide-react";

export function BioCreateButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function create() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/bio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Untitled page", slug: "" }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error?.message || "Could not create page");
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
    <div className="flex flex-col items-end gap-1">
      {error && <span className="text-xs text-red-600">{error}</span>}
      <button type="button" onClick={create} disabled={loading} className="btn-primary">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} New page
      </button>
    </div>
  );
}