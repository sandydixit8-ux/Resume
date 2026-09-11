"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/form";

const STATUSES = ["", "NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "NEGOTIATION", "WON", "LOST", "NURTURE"];
const PRIORITIES = ["", "HOT", "WARM", "COLD"];

export function LeadsFilters({ sources }: { sources: string[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    router.push(`/leads?${next.toString()}`);
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <SearchInput
        value={q}
        onChange={(v) => {
          setQ(v);
          const t = setTimeout(() => update("q", v), 400);
          return () => clearTimeout(t);
        }}
        placeholder="Search by name, company, mobile…"
        className="flex-1"
      />
      <div className="grid grid-cols-3 gap-2">
        <Select value={params.get("status") ?? ""} onChange={(e) => update("status", e.target.value)} aria-label="Filter by status">
          <option value="">Status</option>
          {STATUSES.filter(Boolean).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
        <Select value={params.get("priority") ?? ""} onChange={(e) => update("priority", e.target.value)} aria-label="Filter by priority">
          <option value="">Priority</option>
          {PRIORITIES.filter(Boolean).map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </Select>
        <Select value={params.get("source") ?? ""} onChange={(e) => update("source", e.target.value)} aria-label="Filter by source">
          <option value="">Source</option>
          {sources.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}