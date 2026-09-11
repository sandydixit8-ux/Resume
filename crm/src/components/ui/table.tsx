import * as React from "react";
import { cn } from "@/lib/utils";

export function Table({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn("w-full caption-bottom text-sm", className)} {...props} />
    </div>
  );
}

export function TableHeader({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("[&_tr]:border-b [&_tr]:border-[var(--border)]", className)} {...props} />;
}

export function TableBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />;
}

export function TableRow({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        "border-b border-[var(--border)] transition-colors hover:bg-zinc-50/70",
        className
      )}
      {...props}
    />
  );
}

export function TableHead({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "h-10 px-3 text-left align-middle text-[11px] font-semibold uppercase tracking-wide text-muted-foreground",
        className
      )}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("px-3 py-2.5 align-middle", className)} {...props} />;
}

export function TableSkeleton({ rows = 6, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2 p-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-3">
          {Array.from({ length: cols }).map((_, j) => (
            <div
              key={j}
              className="h-6 flex-1 animate-pulse rounded bg-zinc-100"
              style={{ animationDelay: `${i * 60}ms` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange?: (page: number) => void;
}

export function Pagination({ page, pageSize, total, onPageChange }: PaginationProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const setPage = (p: number) => onPageChange?.(Math.max(1, Math.min(pages, p)));
  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2 text-xs text-muted-foreground">
      <span>
        {total > 0 ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}` : "0 results"}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => setPage(page - 1)}
          disabled={page <= 1}
          className="rounded-md border border-[var(--border)] px-2 py-1 hover:bg-zinc-50 disabled:opacity-40"
        >
          Prev
        </button>
        <span className="px-1 tabular-nums">
          {page}/{pages}
        </span>
        <button
          onClick={() => setPage(page + 1)}
          disabled={page >= pages}
          className="rounded-md border border-[var(--border)] px-2 py-1 hover:bg-zinc-50 disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
