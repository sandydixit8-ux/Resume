import Link from "next/link";
import type { Metadata } from "next";
import { Truck } from "lucide-react";
import { listDeliveries } from "@/lib/data/sales";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge, deliveryStatusTone, humanize } from "@/components/ui/badge";
import { Select } from "@/components/ui/form";
import { Pagination, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Deliveries" };
export const dynamic = "force-dynamic";

const DELIVERY_STATUSES = ["PENDING", "ASSIGNED", "PICKED", "DISPATCHED", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED", "FAILED", "RETURNED"];

export default async function DeliveriesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const status = sp.status;
  const page = Math.max(1, Number(sp.page ?? 1));
  const { rows, total } = await listDeliveries({ status, page });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <form className="flex flex-1 gap-2" action="/deliveries">
          <Select name="status" defaultValue={status ?? ""} className="h-9 max-w-[220px]">
            <option value="">All statuses</option>
            {DELIVERY_STATUSES.map((s) => (
              <option key={s} value={s}>
                {humanize(s)}
              </option>
            ))}
          </Select>
          <button
            type="submit"
            className="hidden h-9 items-center rounded-lg bg-zinc-100 px-4 text-xs font-medium hover:bg-zinc-200 md:inline-flex"
          >
            Filter
          </button>
        </form>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="No deliveries yet"
          description="Deliveries are created automatically when an order is dispatched."
        />
      ) : (
        <div className="rounded-xl border border-[var(--border)] bg-white shadow-sm">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Delivery</TableHead>
                  <TableHead className="hidden sm:table-cell">Order</TableHead>
                  <TableHead className="hidden sm:table-cell">Customer</TableHead>
                  <TableHead className="hidden md:table-cell">Created</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.delivery.id}>
                    <TableCell>
                      <Link href={`/deliveries/${r.delivery.id}`} className="text-sm font-medium hover:underline">
                        {r.delivery.tracking_no ?? r.delivery.id.slice(0, 8)}
                      </Link>
                      {r.delivery.driver_name ? (
                        <span className="block text-xs text-muted-foreground">{r.delivery.driver_name}</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="hidden text-xs sm:table-cell">{r.order_no}</TableCell>
                    <TableCell className="hidden text-xs sm:table-cell">{r.customer_name}</TableCell>
                    <TableCell className="hidden text-xs md:table-cell">{formatDateTime(r.delivery.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <Badge tone={deliveryStatusTone(r.delivery.status)}>{humanize(r.delivery.status)}</Badge>
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