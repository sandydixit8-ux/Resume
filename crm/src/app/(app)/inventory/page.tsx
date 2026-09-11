import Link from "next/link";
import type { Metadata } from "next";
import { PackageX, Boxes } from "lucide-react";
import { listInventory, listWarehouses, getInventoryStats } from "@/lib/data/inventory";
import { listProductOptions } from "@/lib/data/products";
import { getUserContext, hasPermission } from "@/lib/auth";
import { PERM } from "@/lib/rbac";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/ui/kpi-card";
import { Select } from "@/components/ui/form";
import { Pagination, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { InventoryActions } from "@/components/sales/inventory-actions";

export const metadata: Metadata = { title: "Inventory" };
export const dynamic = "force-dynamic";

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ warehouse?: string; low?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const warehouseId = sp.warehouse;
  const lowOnly = sp.low === "1";
  const page = Math.max(1, Number(sp.page ?? 1));

  const [stats, warehouses, { rows, total }, products, ctx] = await Promise.all([
    getInventoryStats(),
    listWarehouses(),
    listInventory({ warehouseId, lowOnly, page }),
    listProductOptions(),
    getUserContext(),
  ]);

  const canAdjust = hasPermission(ctx, PERM.inventoryAdjust);
  const canTransfer = hasPermission(ctx, PERM.inventoryTransfer);
  const canCreateWarehouse = hasPermission(ctx, PERM.inventoryTransfer);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <KpiCard label="Products" value={stats.totalProducts} />
        <KpiCard label="Low stock items" value={stats.lowStockCount} hint={stats.lowStockCount > 0 ? "needs restock" : "all healthy"} />
        <KpiCard label="Warehouses" value={stats.warehouses} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <form className="flex flex-1 gap-2" action="/inventory">
          <Select name="warehouse" defaultValue={warehouseId ?? ""} className="h-9 max-w-[240px]">
            <option value="">All warehouses</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </Select>
          <label className="flex h-9 items-center gap-1.5 rounded-lg border border-[var(--input)] bg-white px-3 text-xs font-medium">
            <input type="checkbox" name="low" value="1" defaultChecked={lowOnly} className="accent-[var(--primary)]" />
            Low stock only
          </label>
          <button
            type="submit"
            className="hidden h-9 items-center rounded-lg bg-zinc-100 px-4 text-xs font-medium hover:bg-zinc-200 md:inline-flex"
          >
            Filter
          </button>
        </form>
        <Link
          href="/stock-movement"
          className="inline-flex h-9 items-center rounded-lg border border-[var(--input)] bg-white px-3 text-xs font-medium text-foreground hover:bg-zinc-50"
        >
          View ledger
        </Link>
        <Link
          href="/warehouses"
          className="inline-flex h-9 items-center rounded-lg border border-[var(--input)] bg-white px-3 text-xs font-medium text-foreground hover:bg-zinc-50"
        >
          Warehouses
        </Link>
        <InventoryActions
          products={products}
          warehouses={warehouses}
          canAdjust={canAdjust}
          canTransfer={canTransfer}
          canCreateWarehouse={canCreateWarehouse}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={lowOnly ? PackageX : Boxes}
          title={lowOnly ? "No low-stock items" : "No stock recorded yet"}
          description={lowOnly ? "Everything is above its minimum stock level." : "Stock appears when a purchase, adjustment or transfer is recorded."}
        />
      ) : (
        <div className="rounded-xl border border-[var(--border)] bg-white shadow-sm">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="hidden sm:table-cell">Warehouse</TableHead>
                  <TableHead className="text-right">On hand</TableHead>
                  <TableHead className="hidden text-right md:table-cell">Min stock</TableHead>
                  <TableHead className="text-right">Level</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.inventory.id}>
                    <TableCell>
                      <Link href={`/products/${r.product.id}`}>
                        <span className="block text-sm font-medium hover:underline">{r.product.name}</span>
                        <span className="block text-xs text-muted-foreground">{r.product.sku}</span>
                      </Link>
                    </TableCell>
                    <TableCell className="hidden text-xs sm:table-cell">{r.warehouse.name}</TableCell>
                    <TableCell className="text-right text-sm font-medium tabular-nums">
                      {r.inventory.quantity} {r.product.unit}
                    </TableCell>
                    <TableCell className="hidden text-right text-xs tabular-nums md:table-cell">{r.product.min_stock}</TableCell>
                    <TableCell className="text-right">
                      {r.lowStock ? <Badge tone="danger">Low stock</Badge> : <Badge tone="success">In stock</Badge>}
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