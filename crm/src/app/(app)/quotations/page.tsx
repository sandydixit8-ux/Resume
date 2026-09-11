import Link from "next/link";
import type { Metadata } from "next";
import { Plus, FileText } from "lucide-react";
import { listQuotations } from "@/lib/data/sales";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge, quoteStatusTone, humanize } from "@/components/ui/badge";
import { Select } from "@/components/ui/form";
import { Pagination, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Quotations" };
export const dynamic = "force-dynamic";

const QUOTE_STATUSES = ["DRAFT", "SENT", "VIEWED", "ACCEPTED", "REJECTED", "EXPIRED", "CONVERTED"];

export default async function QuotationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const status = sp.status;
  const page = Math.max(1, Number(sp.page ?? 1));
  const { quotations, total, customerNames } = await listQuotations({ q: sp.q, status, page });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <form className="flex flex-1 gap-2" action="/quotations">
          <input
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="Search quote number..."
            aria-label="Search quotations"
            className="h-9 w-full min-w-0 flex-1 rounded-lg border border-[var(--input)] bg-white px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40"
          />
          <div className="hidden sm:block">
            <Select name="status" defaultValue={status ?? ""} className="h-9">
              <option value="">All statuses</option>
              {QUOTE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {humanize(s)}
                </option>
              ))}
            </Select>
          </div>
          <button
            type="submit"
            className="hidden h-9 items-center rounded-lg bg-zinc-100 px-4 text-xs font-medium hover:bg-zinc-200 md:inline-flex"
          >
            Search
          </button>
        </form>
        <Link
          href="/quotations/new"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 py-2 text-xs font-medium text-white shadow-sm hover:bg-[var(--primary-hover)]"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Create quote</span>
        </Link>
      </div>

      {quotations.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={sp.q ? "No quotations match your search" : "No quotations yet"}
          description="Create a quotation to share pricing with a customer, then track it to acceptance."
          action={
            <Link
              href="/quotations/new"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 py-2 text-xs font-medium text-white"
            >
              <Plus className="h-4 w-4" /> Create quote
            </Link>
          }
        />
      ) : (
        <div className="rounded-xl border border-[var(--border)] bg-white shadow-sm">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quote</TableHead>
                  <TableHead className="hidden sm:table-cell">Customer</TableHead>
                  <TableHead className="hidden md:table-cell">Date</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotations.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell>
                      <Link href={`/quotations/${q.id}`} className="text-sm font-medium hover:underline">
                        {q.quote_no}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden text-xs sm:table-cell">
                      {q.customer_id ? (customerNames[q.customer_id] ?? "-") : "-"}
                    </TableCell>
                    <TableCell className="hidden text-xs md:table-cell">{formatDate(q.date)}</TableCell>
                    <TableCell className="text-right text-sm font-medium tabular-nums">{formatMoney(q.total)}</TableCell>
                    <TableCell className="text-right">
                      <Badge tone={quoteStatusTone(q.status)}>{humanize(q.status)}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pagination page={page} pageSize={20} total={total} />
        </div>
      )}
    </div>
  );
}