import Link from "next/link";
import type { Metadata } from "next";
import { ScrollText } from "lucide-react";
import { listStockMovements } from "@/lib/data/inventory";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge, stockTransactionTone, humanize } from "@/components/ui/badge";
import { Select } from "@/components/ui/form";
import { Pagination, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Stock movements" };
export const dynamic = "force-dynamic";

const TYPES = ["PURCHASE", "SALE", "RETURN", "ADJUSTMENT", "TRANSFER_IN", "TRANSFER_OUT", "DAMAGE"];

export default async function StockMovementPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const type = sp.type;
  const page = Math.max(1, Number(sp.page ?? 1));
  const { rows, total } = await listStockMovements({ type, page });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <form className="flex flex-1 gap-2" action="/stock-movement">
          <Select name="type" defaultValue={type ?? ""} className="h-9 max-w-[220px]">
            <option value="">All types</option>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {humanize(t)}
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
        <Link
          href="/inventory"
          className="inline-flex h-9 items-center rounded-lg border border-[var(--input)] bg-white px-3 text-xs font-medium text-foreground hover:bg-zinc-50"
        >
          Back to inventory
        </Link>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="No stock movements yet"
          description="Every purchase, sale, adjustment and transfer is recorded here as an immutable ledger row."
        />
      ) : (
        <div className="rounded-xl border border-[var(--border)] bg-white shadow-sm">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="hidden sm:table-cell">Warehouse</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="hidden md:table-cell">When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.txn.id}>
                    <TableCell>
                      <Badge tone={stockTransactionTone(r.txn.type)}>{humanize(r.txn.type)}</Badge>
                    </TableCell>
                    <TableCell>
                      <span className="block text-sm font-medium">{r.product_name}</span>
                      <span className="block text-xs text-muted-foreground">{r.product_sku}</span>
                    </TableCell>
                    <TableCell className="hidden text-xs sm:table-cell">{r.warehouse_name}</TableCell>
                    <TableCell
                      className={`text-right text-sm font-semibold tabular-nums ${
                        Number(r.txn.quantity) > 0 ? "text-emerald-700" : "text-red-600"
                      }`}
                    >
                      {Number(r.txn.quantity) > 0 ? "+" : ""}
                      {r.txn.quantity}
                    </TableCell>
                    <TableCell className="hidden text-xs md:table-cell">{formatDateTime(r.txn.created_at)}</TableCell>
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