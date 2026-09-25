"use client";

import { useEffect, useState } from "react";

interface Summary {
  visitors: number;
  pageViews: number;
  leads: number;
  bookings: number;
  conversions: number;
  conversionRate: number;
  revenueCents: number;
}

export function SummaryCards({ initial }: { initial: Summary }) {
  const [data] = useState(initial);

  const cards = [
    { label: "Visitors", value: fmt(data.visitors), accent: "text-brand-600" },
    { label: "Page views", value: fmt(data.pageViews), accent: "text-navy-600" },
    { label: "Leads", value: fmt(data.leads), accent: "text-emerald-600" },
    { label: "Bookings", value: fmt(data.bookings), accent: "text-indigo-600" },
    { label: "Conversion", value: `${data.conversionRate}%`, accent: "text-amber-600" },
    { label: "Revenue", value: `$${(data.revenueCents / 100).toFixed(2)}`, accent: "text-navy-900" },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {cards.map((c) => (
        <div key={c.label} className="card p-4">
          <div className="text-xs font-medium text-navy-500">{c.label}</div>
          <div className={`mt-1 text-2xl font-bold ${c.accent}`}>{c.value}</div>
        </div>
      ))}
    </div>
  );
}

function fmt(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}