import Link from "next/link";
import type { Metadata } from "next";
import { Plus, ShoppingCart } from "lucide-react";
import { listOrders } from "@/lib/data/sales";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge, orderStatusTone, humanize } from "@/components/ui/badge";
import { Select } from "@/components/ui/form";
import { Pagination, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Orders" };
export const dynamic = "force-dynamic";

const ORDER_STATUSES = [
  "DRAFT",
  "CONFIRMED",
  "PROCESSING",
  "PACKED",
  "DISPATCHED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
  "RETURNED",
];

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const status = sp.status;
  const page = Math.max(1, Number(sp.page ?? 1));
  const { orders, total, customerNames } = await listOrders({ q: sp.q, status, page });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <form className="flex flex-1 gap-2" action="/orders">
          <input
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="Search order number..."
            aria-label="Search orders"
            className="h-9 w-full min-w-0 flex-1 rounded-lg border border-[var(--input)] bg-white px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40"
          />
          <div className="hidden sm:block">
            <Select name="status" defaultValue={status ?? ""} className="h-9">
              <option value="">All statuses</option>
              {ORDER_STATUSES.map((s) => (
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
          href="/orders/new"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 py-2 text-xs font-medium text-white shadow-sm hover:bg-[var(--primary-hover)]"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Create order</span>
        </Link>
      </div>

      {orders.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title={sp.q ? "No orders match your search" : "No orders yet"}
          description="Create an order from an accepted quotation or directly, then move it through to delivery."
          action={
            <Link
              href="/orders/new"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 py-2 text-xs font-medium text-white"
            >
              <Plus className="h-4 w-4" /> Create order
            </Link>
          }
        />
      ) : (
        <div className="rounded-xl border border-[var(--border)] bg-white shadow-sm">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead className="hidden sm:table-cell">Customer</TableHead>
                  <TableHead className="hidden md:table-cell">Created</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell>
                      <Link href={`/orders/${o.id}`} className="text-sm font-medium hover:underline">
                        {o.order_no}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden text-xs sm:table-cell">
                      {customerNames[o.customer_id] ?? "Unknown"}
                    </TableCell>
                    <TableCell className="hidden text-xs md:table-cell">{formatDate(o.created_at)}</TableCell>
                    <TableCell className="text-right text-sm font-medium tabular-nums">{formatMoney(o.total)}</TableCell>
                    <TableCell className="text-right">
                      <Badge tone={orderStatusTone(o.status)}>{humanize(o.status)}</Badge>
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