import Link from "next/link";
import type { Metadata } from "next";
import { Plus, Contact2 } from "lucide-react";
import { listCustomers } from "@/lib/data/customers";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, initials } from "@/lib/utils";

export const metadata: Metadata = { title: "Customers" };
export const dynamic = "force-dynamic";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q;
  const page = Math.max(1, Number(sp.page ?? 1));
  const { customers, total } = await listCustomers({ q, page });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <form className="flex flex-1 gap-2" action="/customers">
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search customers..."
            aria-label="Search customers"
            className="h-9 w-full flex-1 rounded-lg border border-[var(--input)] bg-white px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40"
          />
          <button
            type="submit"
            className="hidden h-9 items-center rounded-lg bg-zinc-100 px-4 text-xs font-medium hover:bg-zinc-200 sm:inline-flex"
          >
            Search
          </button>
        </form>
        <Link
          href="/customers/new"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 py-2 text-xs font-medium text-white shadow-sm hover:bg-[var(--primary-hover)]"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Add customer</span>
        </Link>
      </div>

      {customers.length === 0 ? (
        <EmptyState
          icon={Contact2}
          title={q ? "No customers match your search" : "No customers yet"}
          description="Customers appear here when a lead is converted or when you add them directly."
          action={
            <Link
              href="/customers/new"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 py-2 text-xs font-medium text-white"
            >
              <Plus className="h-4 w-4" /> Add customer
            </Link>
          }
        />
      ) : (
        <div className="rounded-xl border border-[var(--border)] bg-white shadow-sm">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead className="hidden sm:table-cell">City</TableHead>
                  <TableHead className="hidden md:table-cell">Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Link href={`/customers/${c.id}`} className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-[11px] font-semibold text-emerald-700">
                          {initials(c.name)}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{c.name}</span>
                          <span className="block text-xs text-muted-foreground">{c.customer_no}</span>
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <span className="block text-xs">{c.mobile ?? "-"}</span>
                      <span className="block max-w-[180px] truncate text-[11px] text-muted-foreground">{c.email ?? ""}</span>
                    </TableCell>
                    <TableCell className="hidden text-xs sm:table-cell">{c.city ?? "-"}</TableCell>
                    <TableCell className="hidden text-xs md:table-cell">{formatDate(c.created_at)}</TableCell>
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