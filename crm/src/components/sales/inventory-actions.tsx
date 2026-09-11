"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SlidersHorizontal, ArrowLeftRight, Warehouse as WarehouseIcon } from "lucide-react";
import { adjustInventory, transferInventory, createWarehouse } from "@/lib/actions/sales";
import type { ProductPickerOption } from "@/lib/data/products";
import type { Warehouse } from "@/types/supabase";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Field, Input, Select } from "@/components/ui/form";

type ActionResult = { success: boolean; error?: string; id?: string };

export function InventoryActions({
  products,
  warehouses,
  canAdjust,
  canTransfer,
  canCreateWarehouse,
}: {
  products: ProductPickerOption[];
  warehouses: Warehouse[];
  canAdjust: boolean;
  canTransfer: boolean;
  canCreateWarehouse: boolean;
}) {
  const router = useRouter();
  const [sheet, setSheet] = useState<null | "adjust" | "transfer" | "warehouse">(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function run(action: (prev: unknown, fd: FormData) => Promise<ActionResult | undefined>) {
    return async (fd: FormData) => {
      setPending(true);
      setError(null);
      const res = await action(null, fd);
      setPending(false);
      if (res?.success) {
        setSheet(null);
        router.refresh();
      } else {
        setError(res?.error ?? "Something went wrong.");
      }
    };
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {canAdjust ? (
          <Button variant="outline" size="sm" onClick={() => setSheet("adjust")}>
            <SlidersHorizontal className="h-3.5 w-3.5" /> Adjust stock
          </Button>
        ) : null}
        {canTransfer ? (
          <Button variant="outline" size="sm" onClick={() => setSheet("transfer")}>
            <ArrowLeftRight className="h-3.5 w-3.5" /> Transfer
          </Button>
        ) : null}
        {canCreateWarehouse ? (
          <Button variant="outline" size="sm" onClick={() => setSheet("warehouse")}>
            <WarehouseIcon className="h-3.5 w-3.5" /> New warehouse
          </Button>
        ) : null}
      </div>

      <Sheet
        open={sheet === "adjust"}
        onOpenChange={(o) => !o && setSheet(null)}
        title="Adjust stock"
        description="Recorded in the immutable ledger. Use SALE for goods leaving the warehouse."
        footer={
          <>
            <Button variant="outline" className="flex-1" onClick={() => setSheet(null)}>
              Cancel
            </Button>
            <Button type="submit" form="inv-adjust" className="flex-1" loading={pending}>
              Save adjustment
            </Button>
          </>
        }
      >
        <form id="inv-adjust" action={run(adjustInventory)} className="space-y-4">
          <Field label="Product" required>
            <Select name="product_id" required>
              <option value="">Select product…</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.sku})
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Warehouse" required>
            <Select name="warehouse_id" required>
              <option value="">Select warehouse…</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Type" required>
              <Select name="type" defaultValue="ADJUSTMENT">
                <option value="ADJUSTMENT">Adjustment</option>
                <option value="PURCHASE">Purchase</option>
                <option value="RETURN">Return</option>
                <option value="DAMAGE">Damage</option>
              </Select>
            </Field>
            <Field label="Quantity" hint="Negative reduces stock" required>
              <Input name="quantity" type="number" step="any" placeholder="e.g. 10 or -5" required />
            </Field>
          </div>
          <Field label="Note">
            <Input name="note" placeholder="Reason for adjustment" />
          </Field>
          {error && sheet === "adjust" ? (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </p>
          ) : null}
        </form>
      </Sheet>

      <Sheet
        open={sheet === "transfer"}
        onOpenChange={(o) => !o && setSheet(null)}
        title="Transfer stock"
        description="Moves stock between warehouses; both legs are recorded in the ledger."
        footer={
          <>
            <Button variant="outline" className="flex-1" onClick={() => setSheet(null)}>
              Cancel
            </Button>
            <Button type="submit" form="inv-transfer" className="flex-1" loading={pending}>
              Transfer
            </Button>
          </>
        }
      >
        <form id="inv-transfer" action={run(transferInventory)} className="space-y-4">
          <Field label="Product" required>
            <Select name="product_id" required>
              <option value="">Select product…</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.sku})
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="From warehouse" required>
              <Select name="from_warehouse_id" required>
                <option value="">Select…</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="To warehouse" required>
              <Select name="to_warehouse_id" required>
                <option value="">Select…</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Quantity" required>
            <Input name="quantity" type="number" min={0.0001} step="any" required />
          </Field>
          <Field label="Note">
            <Input name="note" placeholder="Optional note" />
          </Field>
          {error && sheet === "transfer" ? (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </p>
          ) : null}
        </form>
      </Sheet>

      <Sheet
        open={sheet === "warehouse"}
        onOpenChange={(o) => !o && setSheet(null)}
        title="New warehouse"
        description="Warehouses hold stock; choose one when creating orders."
        footer={
          <>
            <Button variant="outline" className="flex-1" onClick={() => setSheet(null)}>
              Cancel
            </Button>
            <Button type="submit" form="inv-warehouse" className="flex-1" loading={pending}>
              Create warehouse
            </Button>
          </>
        }
      >
        <form id="inv-warehouse" action={run(createWarehouse)} className="space-y-4">
          <Field label="Warehouse name" required>
            <Input name="name" placeholder="Central Warehouse" required />
          </Field>
          <Field label="Address">
            <Input name="address" placeholder="Street, area, city" />
          </Field>
          {error && sheet === "warehouse" ? (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </p>
          ) : null}
        </form>
      </Sheet>
    </>
  );
}
