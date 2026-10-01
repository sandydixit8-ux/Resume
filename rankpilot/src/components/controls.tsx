"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";

export function StatusSelect({
  endpoint,
  value,
  options,
  disabled,
}: {
  endpoint: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function change(next: string) {
    if (next === value) return;
    setBusy(true);
    setError(null);
    const res = await api(endpoint, { method: "PATCH", json: { status: next } });
    setBusy(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-1">
      <select
        className="input w-auto"
        value={value}
        disabled={busy || disabled}
        onChange={(e) => change(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}

export const ISSUE_STATUSES = [
  { value: "new", label: "New" },
  { value: "in_progress", label: "In progress" },
  { value: "resolved", label: "Resolved" },
  { value: "ignored", label: "Ignored" },
];

export const ACTION_STATUSES = [
  { value: "new", label: "New" },
  { value: "in_progress", label: "In progress" },
  { value: "review", label: "In review" },
  { value: "approved", label: "Approved" },
  { value: "completed", label: "Completed" },
];
