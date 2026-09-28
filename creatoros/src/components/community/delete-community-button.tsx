"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

export function DeleteCommunityButton({ communityId, name }: { communityId: string; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!confirm(`Delete "${name}" and all of its posts? This cannot be undone.`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/community/${communityId}`, { method: "DELETE" });
      const json = await res.json();
      if (json.ok) router.push("/app/community");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" onClick={remove} disabled={busy} className="btn-secondary text-red-600">
      <Trash2 className="h-4 w-4" /> Delete community
    </button>
  );
}