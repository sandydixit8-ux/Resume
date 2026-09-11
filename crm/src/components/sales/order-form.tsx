"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createOrder } from "@/lib/actions/sales";
import type { CustomerOption } from "@/lib/data/sales";
import type { ProductPickerOption } from "@/lib/data/products";
import type { Warehouse } from "@/types/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { LineItems } from "@/components/sales/line-items";

export function OrderForm({
  customers,
  products,
  warehouses,
  salespeople,
}: {
  customers: CustomerOption[];
  products: ProductPickerOption[];
  warehouses: Warehouse[];
  salespeople: { id: string; full_name: string }[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const res = await createOrder(null, formData);
    setPending(false);
    if (res?.success && "id" in res) {
      router.push(`/orders/${res.id}`);
    } else {
      setError("error" in res ? res.error : "Could not create the order.");
    }
  }

  return (
    <form action={onSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>New order</CardTitle>
          <CardDescription>Stock is deducted when the order is dispatched, not when it is created.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Customer" required>
              <Select name="customer_id" required>
                <option value="">Select customer…</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.customer_no})
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Salesperson">
              <Select name="salesperson_id">
                <option value="">You (default)</option>
                {salespeople.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Fulfil from warehouse" hint="Stock is deducted from this warehouse at dispatch.">
              <Select name="warehouse_id">
                <option value="">No warehouse (no stock deduction)</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Delivery date">
              <Input name="delivery_date" type="date" />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Delivery address">
              <Input name="delivery_address" placeholder="Shop/office address" />
            </Field>
            <Field label="Delivery city">
              <Input name="delivery_city" placeholder="Delhi" />
            </Field>
          </div>
          <Field label="Line items" hint="Prices default to the product selling price and GST rate.">
            <LineItems products={products} />
          </Field>
          <Field label="Notes">
            <Textarea name="notes" placeholder="Anything the warehouse or delivery team should know…" />
          </Field>
          {error ? (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </p>
          ) : null}
        </CardContent>
        <div className="flex gap-2 border-t border-[var(--border)] p-4">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" loading={pending} className="flex-1">
            Create order
          </Button>
        </div>
      </Card>
    </form>
  );
}
