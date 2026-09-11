import Link from "next/link";
import type { Metadata } from "next";
import { Warehouse as WarehouseIcon } from "lucide-react";
import { listWarehouses } from "@/lib/data/inventory";
import { listProductOptions } from "@/lib/data/products";
import { getUserContext, hasPermission } from "@/lib/auth";
import { PERM } from "@/lib/rbac";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Pagination, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { InventoryActions } from "@/components/sales/inventory-actions";

export const metadata: Metadata = { title: "Warehouses" };
export const dynamic = "force-dynamic";

export default async function WarehousesPage() {
  const [warehouses, products, ctx] = await Promise.all([listWarehouses(), listProductOptions(), getUserContext()]);
  const page = Math.max(1, 1);
  const canCreateWarehouse = hasPermission(ctx, PERM.inventoryTransfer);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">Warehouses</h2>
          <p className="text-xs text-muted-foreground">Warehouses hold stock; choose one when creating orders.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/inventory"
            className="inline-flex h-9 items-center rounded-lg border border-[var(--input)] bg-white px-3 text-xs font-medium text-foreground hover:bg-zinc-50"
          >
            Back to inventory
          </Link>
          <InventoryActions products={products} warehouses={warehouses} canAdjust={false} canTransfer={false} canCreateWarehouse={canCreateWarehouse} />
        </div>
      </div>

      {warehouses.length === 0 ? (
        <EmptyState
          icon={WarehouseIcon}
          title="No warehouses yet"
          description="Add a warehouse so orders can deduct stock from a location."
        />
      ) : (
        <div className="rounded-xl border border-[var(--border)] bg-white shadow-sm">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Warehouse</TableHead>
                  <TableHead className="hidden sm:table-cell">Address</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {warehouses.map((w) => (
                  <TableRow key={w.id}>
                    <TableCell>
                      <span className="block text-sm font-medium">{w.name}</span>
                    </TableCell>
                    <TableCell className="hidden text-xs sm:table-cell">{w.address ?? "-"}</TableCell>
                    <TableCell className="text-right">
                      {w.is_active ? <Badge tone="success">Active</Badge> : <Badge>Inactive</Badge>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pagination page={page} pageSize={20} total={warehouses.length} />
        </div>
      )}
    </div>
  );
}