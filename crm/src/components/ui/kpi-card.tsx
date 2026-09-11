import * as React from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function KpiCard({
  label,
  value,
  hint,
  delta,
  icon,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  delta?: number;
  icon?: React.ReactNode;
  className?: string;
}) {
  const up = (delta ?? 0) >= 0;
  return (
    <div
      className={cn(
        "rounded-xl border border-[var(--border)] bg-[var(--card)] p-3.5 shadow-sm",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        {icon ? <span className="text-muted-foreground">{icon}</span> : null}
      </div>
      <p className="mt-1 truncate text-lg font-bold tabular-nums tracking-tight">{value}</p>
      <div className="mt-0.5 flex items-center gap-2">
        {delta !== undefined ? (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-[11px] font-medium",
              up ? "text-[var(--success)]" : "text-[var(--destructive)]"
            )}
          >
            {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {Math.abs(delta)}%
          </span>
        ) : null}
        {hint ? <span className="truncate text-[11px] text-muted-foreground">{hint}</span> : null}
      </div>
    </div>
  );
}