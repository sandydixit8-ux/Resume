"use client";

import { formatMoneyCents } from "@/lib/money-format";

interface RevenueMonth {
  month: string;
  cents: number;
}

export function RevenueChart({ data }: { data: RevenueMonth[] }) {
  const max = Math.max(1, ...data.map((d) => d.cents));
  const width = 720;
  const height = 220;
  const padX = 32;
  const padY = 16;

  const bars = data.map((d, i) => {
    const slot = (width - padX * 2) / data.length;
    const barW = Math.max(8, slot * 0.55);
    const barH = (d.cents / max) * (height - padY * 2);
    const x = padX + i * slot + (slot - barW) / 2;
    const y = padY + (height - padY * 2) - barH;
    return { d, x, y, barW, barH };
  });

  const total = data.reduce((s, d) => s + d.cents, 0);
  if (total === 0) return <div className="py-10 text-center text-sm text-navy-400">No revenue recorded yet — it shows up once you start charging.</div>;

  return (
    <div>
      <div className="mb-1 text-3xl font-bold text-navy-950">{formatMoneyCents(total)}</div>
      <div className="mb-4 text-xs text-navy-400">Total received in the period</div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Revenue by month">
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line key={f} x1={padX} x2={width - padX} y1={padY + (height - padY * 2) - f * (height - padY * 2)} y2={padY + (height - padY * 2) - f * (height - padY * 2)} stroke="#e9edf5" strokeWidth="1" />
        ))}
        {bars.map((b) => (
          <g key={b.d.month}>
            <title>{`${b.d.month}: ${formatMoneyCents(b.d.cents)}`}</title>
            <rect x={b.x} y={b.y} width={b.barW} height={b.barH} rx="4" fill="#4f46e5" opacity="0.9" />
            <text x={b.x + b.barW / 2} y={height - 4} textAnchor="middle" fontSize="10" fill="#94a3b8">
              {b.d.month.slice(2)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export function RevenueBreakdown({ sources }: { sources: { label: string; count: number; cents: number }[] }) {
  const total = sources.reduce((s, x) => s + x.cents, 0);
  const maxCents = Math.max(1, ...sources.map((x) => x.cents));

  return (
    <div className="space-y-4">
      {sources.map((s) => (
        <div key={s.label}>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="text-navy-600">{s.label}</span>
            <span className="font-semibold text-navy-900">
              {formatMoneyCents(s.cents)}
              {s.count > 0 && <span className="ml-2 text-xs font-normal text-navy-400">× {s.count}</span>}
            </span>
          </div>
          <div className="h-2 rounded-full bg-navy-100">
            <div
              className="h-2 rounded-full bg-gradient-to-r from-brand-500 to-indigo-500"
              style={{ width: `${total === 0 ? 0 : Math.max(2, (s.cents / maxCents) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}