"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/ui/kpi-card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatMoney } from "@/lib/utils";
import type { ProductDetail as Detail } from "@/lib/data/products";

export function ProductDetailClient({ detail, canEdit }: { detail: Detail; canEdit: boolean }) {
  const [tab, setTab] = useState("overview");
  const router = useRouter();
  const p = detail.product;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[var(--border)] bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold">{p.name}</h2>
              {p.is_active ? <Badge tone="success">Active</Badge> : <Badge>Inactive</Badge>}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {p.sku}
              {detail.categoryName ? ` · ${detail.categoryName}` : ""}
              {p.brand ? ` · ${p.brand}` : ""}
            </p>
          </div>
          {canEdit ? (
            <Button variant="outline" size="sm" onClick={() => router.push(`/products/${p.id}/edit`)}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Selling price" value={formatMoney(p.selling_price)} />
        <KpiCard label="Purchase price" value={formatMoney(p.purchase_price)} />
        <KpiCard label="Stock on hand" value={detail.totalStock} hint={detail.totalStock <= p.min_stock ? "low stock" : "in stock"} />
        <KpiCard label="GST rate" value={`${p.tax_rate}%`} hint={p.hsn_sac ? `HSN ${p.hsn_sac}` : "no HSN"} />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="stock">Stock by warehouse</TabsTrigger>
          <TabsTrigger value="variants">Variants ({detail.variants.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-[var(--border)] bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold">Details</h3>
              <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                {[
                  ["Unit", p.unit],
                  ["Minimum stock", `${p.min_stock} ${p.unit}`],
                  ["Discount %", `${p.discount}%`],
                  ["AI generated", p.is_ai_generated ? "Yes" : "No"],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{k}</dt>
                    <dd className="mt-0.5">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold">Description</h3>
              <p className="text-sm text-muted-foreground">{p.description || "No description."}</p>
              {p.tags && p.tags.length ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {p.tags.map((t) => (
                    <Badge key={t} tone="neutral">
                      {t}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="stock">
          {detail.stockRows.length === 0 ? (
            <p className="rounded-xl border border-[var(--border)] bg-white p-6 text-center text-sm text-muted-foreground">
              No stock recorded yet.
            </p>
          ) : (
            <div className="rounded-xl border border-[var(--border)] bg-white shadow-sm">
              <ul className="divide-y divide-[var(--border)]">
                {detail.stockRows.map((r) => (
                  <li key={r.warehouse_id} className="flex items-center justify-between px-4 py-3 text-sm">
                    <span>{r.warehouse_name}</span>
                    <span className="tabular-nums">
                      {r.quantity} {p.unit}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </TabsContent>

        <TabsContent value="variants">
          {detail.variants.length === 0 ? (
            <p className="rounded-xl border border-[var(--border)] bg-white p-6 text-center text-sm text-muted-foreground">
              No variants. Manage variants in a later phase.
            </p>
          ) : (
            <div className="rounded-xl border border-[var(--border)] bg-white shadow-sm">
              <ul className="divide-y divide-[var(--border)]">
                {detail.variants.map((v) => (
                  <li key={v.id} className="flex items-center justify-between px-4 py-3 text-sm">
                    <span>{v.sku}</span>
                    <span className="tabular-nums">{formatMoney(v.selling_price)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <div className="text-center">
        <Link href="/products" className="text-xs text-muted-foreground hover:underline">
          Back to products
        </Link>
      </div>
    </div>
  );
}
