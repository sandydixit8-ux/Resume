"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";

const ROLES = ["owner", "admin", "editor", "analyst", "client"];

export function MemberControls({
  self,
  currentRole,
  editable,
  membershipId,
  isOwnerMember,
}: {
  self: boolean;
  currentRole: string;
  editable: boolean;
  membershipId: string;
  isOwnerMember: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function changeRole(next: string) {
    setBusy(true);
    setError(null);
    const res = await api("/api/members", { method: "PATCH", json: { membershipId, role: next } });
    setBusy(false);
    if (!res.ok) return setError(res.error.message);
    router.refresh();
  }

  async function remove() {
    setBusy(true);
    setError(null);
    const res = await api("/api/members", { method: "DELETE", json: { membershipId } });
    setBusy(false);
    if (!res.ok) return setError(res.error.message);
    router.refresh();
  }

  if (!editable) return null;

  return (
    <div className="flex items-center gap-2">
      {self ? (
        <span className="text-xs text-ink-400">you</span>
      ) : (
        <>
          <select
            className="input w-auto"
            value={currentRole}
            disabled={busy || currentRole === "owner"}
            onChange={(e) => void changeRole(e.target.value)}
          >
            {ROLES.filter((r) => r !== "owner" || currentRole === "owner").map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <button className="btn-ghost" onClick={() => void remove()} disabled={busy || currentRole === "owner" && isOwnerMember}>
            Remove
          </button>
        </>
      )}
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
