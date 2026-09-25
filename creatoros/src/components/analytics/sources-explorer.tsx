"use client";

import { useState } from "react";

type Part = { label: string; count: number };

export function SourcesExplorer(props: { sources: Part[]; devices: Part[]; countries: Part[] }) {
  const [tab, setTab] = useState<"sources" | "devices" | "countries">("sources");
  const data = tab === "sources" ? props.sources : tab === "devices" ? props.devices : props.countries;
  const total = data.reduce((a, b) => a + b.count, 0);

  return (
    <div className="card p-6">
      <h2 className="mb-4 font-semibold text-navy-900">Breakdown</h2>
      <div className="mb-4 flex gap-1 rounded-xl bg-navy-50 p-1">
        {(["sources", "devices", "countries"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
              tab === t ? "bg-white text-navy-900 shadow-soft" : "text-navy-500 hover:text-navy-700"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      {total === 0 ? (
        <div className="py-8 text-center text-sm text-navy-400">No data yet</div>
      ) : (
        <ul className="space-y-2.5">
          {data.map((p) => (
            <li key={p.label} className="text-sm text-navy-600">
              <div className="flex justify-between">
                <span className="truncate pr-3">{p.label}</span>
                <span className="font-medium text-navy-900">{p.count}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-navy-100">
                <div className="h-full rounded-full bg-brand-500" style={{ width: `${(p.count / total) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}