"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createProduct, createCategory, updateProduct } from "@/lib/actions/sales";
import type { ProductCategory, Product } from "@/types/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";

const UNITS = ["piece", "kg", "bag", "box", "roll", "sheet", "pack", "barrel", "litre", "meter"];

export function ProductForm({ categories, existing }: { categories: ProductCategory[]; existing?: Product }) {
  const router = useRouter();
  const [catName, setCatName] = useState("");
  const [addCatOpen, setAddCatOpen] = useState(false);
  const [catError, setCatError] = useState<string | null>(null);
  const [state, setState] = useState<{ error?: string } | null>(null);
  const [pending, setPending] = useState(false);

  const isEdit = Boolean(existing);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setState(null);
    const id = existing?.id ?? "";
    const res = isEdit ? await updateProduct(id, null, formData) : await createProduct(null, formData);
    setPending(false);
    if (res?.success) {
      router.push(isEdit ? `/products/${id}` : `/products/${"id" in res ? res.id : ""}`);
    } else {
      setState({ error: "error" in res ? res.error : "Something went wrong." });
    }
  }

  async function onAddCategory() {
    setCatError(null);
    const res = await createCategory(catName);
    if (res?.success) {
      setCatName("");
      setAddCatOpen(false);
      window.location.reload();
    } else {
      setCatError("error" in res ? res.error : "Could not add category.");
    }
  }

  return (
    <form action={onSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>{isEdit ? "Edit product" : "New product"}</CardTitle>
          <CardDescription>
            {isEdit ? "Update pricing, tax and catalog details." : "Add an item to your catalog with selling price and GST rate."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Product name" required>
              <Input name="name" defaultValue={existing?.name ?? ""} placeholder="PPR Pipe 20mm" required />
            </Field>
            <Field label="SKU" required>
              <Input name="sku" defaultValue={existing?.sku ?? ""} placeholder="PPR-PIPE-20" required />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Category">
              <div className="flex gap-2">
                <Select name="category_id" defaultValue={existing?.category_id ?? ""}>
                  <option value="">No category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
                {addCatOpen ? (
                  <Input
                    value={catName}
                    onChange={(e) => setCatName(e.target.value)}
                    placeholder="New category"
                    className="w-36"
                    aria-label="New category name"
                  />
                ) : (
                  <Button type="button" variant="outline" onClick={() => setAddCatOpen(true)}>
                    + New
                  </Button>
                )}
                {addCatOpen ? (
                  <Button type="button" onClick={onAddCategory}>
                    Add
                  </Button>
                ) : null}
              </div>
              {catError ? <p className="text-[11px] text-[var(--destructive)]">{catError}</p> : null}
            </Field>
            <Field label="Brand">
              <Input name="brand" defaultValue={existing?.brand ?? ""} placeholder="Brand name" />
            </Field>
            <Field label="Unit">
              <Select name="unit" defaultValue={existing?.unit ?? "piece"}>
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-4">
            <Field label="Selling price (₹)" required>
              <Input name="selling_price" type="number" min={0} step="any" defaultValue={existing?.selling_price ?? 0} />
            </Field>
            <Field label="Purchase price (₹)">
              <Input name="purchase_price" type="number" min={0} step="any" defaultValue={existing?.purchase_price ?? 0} />
            </Field>
            <Field label="GST rate %">
              <Input name="tax_rate" type="number" min={0} max={100} step="any" defaultValue={existing?.tax_rate ?? 18} />
            </Field>
            <Field label="HSN/SAC">
              <Input name="hsn_sac" defaultValue={existing?.hsn_sac ?? ""} placeholder="3917" />
            </Field>
          </div>
          <Field label="Minimum stock" hint="A product is flagged low-stock when its balance drops to this level.">
            <Input name="min_stock" type="number" min={0} step="any" defaultValue={existing?.min_stock ?? 0} />
          </Field>
          <Field label="Description">
            <Textarea name="description" defaultValue={existing?.description ?? ""} placeholder="Notes for the catalog…" />
          </Field>
          {state?.error ? (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
              {state.error}
            </p>
          ) : null}
        </CardContent>
        <div className="flex gap-2 border-t border-[var(--border)] p-4">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" loading={pending} className="flex-1">
            {isEdit ? "Save changes" : "Create product"}
          </Button>
        </div>
      </Card>
    </form>
  );
}
