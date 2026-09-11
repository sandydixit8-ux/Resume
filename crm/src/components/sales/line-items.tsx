"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { ProductPickerOption } from "@/lib/data/products";
import { Button } from "@/components/ui/button";
import { Select, Input } from "@/components/ui/form";
import { formatMoney } from "@/lib/utils";

export interface LineDraft {
  product_id: string;
  quantity: number;
  unit_price: number;
  discount: number;
  tax_rate: number;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Client-side total preview only; the server recomputes and stores the real totals. */
export function previewTotals(items: LineDraft[]): { subtotal: number; tax: number; total: number } {
  const lines = items.map((it) => {
    const subtotal = round2(it.quantity * it.unit_price * (1 - (it.discount || 0) / 100));
    const tax = round2(subtotal * ((it.tax_rate || 0) / 100));
    return { subtotal, tax };
  });
  const subtotal = round2(lines.reduce((s, l) => s + l.subtotal, 0));
  const tax = round2(lines.reduce((s, l) => s + l.tax, 0));
  return { subtotal, tax, total: round2(subtotal + tax) };
}

export function LineItems({ products, name = "items" }: { products: ProductPickerOption[]; name?: string }) {
  const [items, setItems] = useState<LineDraft[]>([{ product_id: "", quantity: 1, unit_price: 0, discount: 0, tax_rate: 18 }]);

  useEffect(() => {
    const input = document.querySelector<HTMLInputElement>(`input[name="${name}"]`);
    if (input) input.value = JSON.stringify(items.filter((i) => i.product_id));
  }, [items, name]);

  const totals = previewTotals(items);

  const selectProduct = (index: number, productId: string) => {
    const p = products.find((x) => x.id === productId);
    setItems((prev) =>
      prev.map((it, i) =>
        i === index
          ? {
              product_id: productId,
              quantity: it.quantity,
              unit_price: p?.selling_price ?? 0,
              discount: it.discount,
              tax_rate: p?.tax_rate ?? 18,
            }
          : it
      )
    );
  };

  const update = (index: number, patch: Partial<LineDraft>) => {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  };

  return (
    <div className="space-y-3">
      <input type="hidden" name={name} defaultValue="[]" readOnly />
      <div className="overflow-hidden rounded-lg border border-[var(--border)]">
        <div className="hidden grid-cols-12 gap-2 border-b border-[var(--border)] bg-zinc-50 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:grid">
          <div className="col-span-4">Product</div>
          <div className="col-span-2">Qty</div>
          <div className="col-span-2">Unit price (₹)</div>
          <div className="col-span-1">Disc %</div>
          <div className="col-span-2">Tax %</div>
          <div className="col-span-1" />
        </div>
        <div className="divide-y divide-[var(--border)]">
          {items.map((it, i) => (
            <div key={i} className="grid grid-cols-2 gap-2 px-3 py-2 sm:grid-cols-12">
              <Select
                className="col-span-2 sm:col-span-4"
                value={it.product_id}
                onChange={(e) => selectProduct(i, e.target.value)}
                aria-label="Product"
              >
                <option value="">Select product…</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.sku})
                  </option>
                ))}
              </Select>
              <Input
                className="sm:col-span-2"
                type="number"
                min={0}
                step="any"
                value={it.quantity}
                onChange={(e) => update(i, { quantity: Number(e.target.value) })}
                aria-label="Quantity"
              />
              <Input
                className="sm:col-span-2"
                type="number"
                min={0}
                step="any"
                value={it.unit_price}
                onChange={(e) => update(i, { unit_price: Number(e.target.value) })}
                aria-label="Unit price"
              />
              <Input
                className="sm:col-span-1"
                type="number"
                min={0}
                max={100}
                step="any"
                value={it.discount}
                onChange={(e) => update(i, { discount: Number(e.target.value) })}
                aria-label="Discount percent"
              />
              <Input
                className="sm:col-span-2"
                type="number"
                min={0}
                max={100}
                step="any"
                value={it.tax_rate}
                onChange={(e) => update(i, { tax_rate: Number(e.target.value) })}
                aria-label="Tax rate"
              />
              <div className="flex items-center justify-end sm:col-span-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Remove item"
                  onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== i))}
                >
                  <Trash2 className="h-4 w-4 text-[var(--destructive)]" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setItems((prev) => [...prev, { product_id: "", quantity: 1, unit_price: 0, discount: 0, tax_rate: 18 }])}
      >
        <Plus className="h-3.5 w-3.5" /> Add item
      </Button>
      <div className="ml-auto w-full max-w-[220px] space-y-1 rounded-lg bg-zinc-50 p-3 text-sm">
        <div className="flex justify-between text-muted-foreground">
          <span>Subtotal</span>
          <span className="tabular-nums">{formatMoney(totals.subtotal)}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Tax</span>
          <span className="tabular-nums">{formatMoney(totals.tax)}</span>
        </div>
        <div className="flex justify-between border-t border-[var(--border)] pt-1 font-semibold">
          <span>Total</span>
          <span className="tabular-nums">{formatMoney(totals.total)}</span>
        </div>
      </div>
    </div>
  );
}
