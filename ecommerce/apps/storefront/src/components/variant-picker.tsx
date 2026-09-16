"use client";

import { useState } from "react";
import { Badge, Button } from "@nexus/ui";
import { cn } from "@nexus/ui";
import type { ProductVariantDto, PromoMetaDto } from "@nexus/contracts";
import { formatINR } from "@/lib/format";
import { useCart } from "@/providers/cart-provider";

function tierFor(variant: ProductVariantDto, qty: number) {
  const tiers = (variant.priceTiers ?? [])
    .filter((t) => t.isActive && t.minQuantity >= 2)
    .sort((a, b) => b.minQuantity - a.minQuantity);
  return tiers.find((t) => qty >= t.minQuantity);
}

function promoLabel(promo: PromoMetaDto): string {
  const amount =
    promo.type === "PERCENTAGE_OFF" ? `${promo.value}% off` : `${formatINR(promo.value)} off`;
  return `${promo.name} · ${amount}`;
}

export function VariantPicker({
  variants,
  availability,
}: {
  variants: ProductVariantDto[];
  availability?: Record<string, { available: number; lowStock: boolean }>;
}) {
  const { addToCart } = useCart();
  const active = variants.filter((v) => v.isActive);
  const [selectedId, setSelectedId] = useState<string | undefined>(active[0]?.id);
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState(false);
  const selected = active.find((v) => v.id === selectedId) ?? active[0];

  if (active.length === 0) return null;

  const stock = selected ? availability?.[selected.id] : undefined;
  const available = stock?.available ?? 0;
  const outOfStock = stock === undefined || available <= 0;
  const maxQty = stock ? Math.min(10, available) : 1;

  const mrp = Number(selected?.mrp ?? 0);
  const basePrice = Number(selected?.price ?? 0);
  const tier = selected ? tierFor(selected, quantity) : undefined;
  const unitPrice = tier ? Number(tier.price) : basePrice;
  const discount = mrp > 0 && unitPrice > 0 && unitPrice < mrp ? Math.round((1 - unitPrice / mrp) * 100) : 0;
  const promos = selected?.promotions ?? [];

  const handleAdd = async () => {
    if (!selected || busy || outOfStock) return;
    setBusy(true);
    try {
      await addToCart(selected.id, quantity);
      setAdded(true);
      setTimeout(() => setAdded(false), 1600);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline gap-3">
        <span className="text-3xl font-bold">{formatINR(unitPrice)}</span>
        {(tier ? Number(tier.price) < mrp : basePrice < mrp) && (
          <>
            <span className="text-lg text-muted-foreground line-through">{formatINR(mrp)}</span>
            <Badge variant="outline">{discount}% off</Badge>
          </>
        )}
      </div>
      {tier && (
        <p className="text-xs font-medium text-emerald-600">
          Tier price applied for {quantity}+ units · <span className="font-mono">{formatINR(unitPrice)}</span> each
        </p>
      )}
      {promos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {promos.map((promo) => (
            <Badge key={promo.id} variant="success" className="normal-case">
              {promoLabel(promo)}
            </Badge>
          ))}
        </div>
      )}
      <div>
        <p className="mb-2 text-sm font-medium">Select options</p>
        <div className="flex flex-wrap gap-2">
          {active.map((variant) => (
            <button
              key={variant.id}
              type="button"
              onClick={() => setSelectedId(variant.id)}
              className={cn(
                "rounded-md border px-3 py-2 text-sm transition-colors",
                selected?.id === variant.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-background hover:border-primary",
              )}
            >
              {variant.options.map((option) => option.value).join(" · ") || variant.name || variant.sku}
            </button>
          ))}
        </div>
      </div>
      {!!selected && selected.priceTiers.length > 0 && (
        <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
          <p className="mb-2 font-medium">Quantity pricing</p>
          <table className="w-full text-left">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-muted-foreground">
                <th className="pb-1">Buy</th>
                <th className="pb-1">Price / unit</th>
                <th className="pb-1">You save</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-border">
                <td className="py-1">1{selected.priceTiers[0]?.minQuantity === 2 ? "" : `-${selected.priceTiers[0].minQuantity - 1}`}</td>
                <td className="py-1">{formatINR(basePrice)}</td>
                <td className="py-1 text-muted-foreground">—</td>
              </tr>
              {selected.priceTiers
                .slice()
                .sort((a, b) => a.minQuantity - b.minQuantity)
                .map((t, index, arr) => {
                  const next = arr[index + 1];
                  const range = next ? `${t.minQuantity}-${next.minQuantity - 1}+` : `${t.minQuantity}+`;
                  return (
                    <tr key={t.id} className={cn("border-t border-border", quantity >= t.minQuantity && "font-semibold text-emerald-600")}>
                      <td className="py-1">{range}</td>
                      <td className="py-1">{formatINR(Number(t.price))}</td>
                      <td className="py-1">{formatINR(basePrice * t.minQuantity - Number(t.price) * t.minQuantity)}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}
      <div className="text-sm text-muted-foreground">
        {selected?.sku && (
          <p>
            SKU: <span className="font-mono">{selected.sku}</span>
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center rounded-md border border-input">
          <button
            type="button"
            aria-label="Decrease quantity"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            className="h-10 w-10 text-lg leading-none transition-colors hover:bg-accent"
          >
            &#8722;
          </button>
          <span className="w-10 text-center text-sm font-medium" aria-live="polite">
            {quantity}
          </span>
          <button
            type="button"
            aria-label="Increase quantity"
            onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
            className="h-10 w-10 text-lg leading-none transition-colors hover:bg-accent"
          >
            +
          </button>
        </div>
        <Button onClick={handleAdd} disabled={busy || outOfStock} className="w-full sm:w-auto">
          {outOfStock ? "Out of Stock" : busy ? "Adding…" : added ? "Added to cart ✓" : "Add to Cart"}
        </Button>
      </div>
      {!outOfStock && stock && stock.lowStock && (
        <p className="text-xs text-amber-600">Only {available} left in stock</p>
      )}
    </div>
  );
}