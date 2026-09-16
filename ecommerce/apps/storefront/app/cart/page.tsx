"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@nexus/ui";
import type { CartDto } from "@nexus/contracts";
import { cartApi } from "@/lib/api";
import { formatINR } from "@/lib/format";
import { useCart } from "@/providers/cart-provider";

export default function CartPage() {
  const { refresh } = useCart();
  const [cart, setCart] = useState<CartDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setCart(await cartApi.getCart());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load cart");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const mutate = useCallback(
    async (action: () => Promise<CartDto>, itemId?: string) => {
      setBusyId(itemId ?? "__cart__");
      try {
        const next = await action();
        setCart(next);
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Cart update failed");
      } finally {
        setBusyId(null);
      }
    },
    [refresh],
  );

  const updateQuantity = (itemId: string, quantity: number) =>
    mutate(() => cartApi.updateItem(itemId, Math.max(1, quantity)), itemId);

  const removeItem = (itemId: string) => mutate(() => cartApi.removeItem(itemId), itemId);

  const clearCart = () => mutate(() => cartApi.clearCart());

  if (loading) {
    return (
      <div className="container-page py-8">
        <h1 className="text-2xl font-bold">Your Cart</h1>
        <p className="mt-4 text-sm text-muted-foreground">Loading your cart…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container-page py-8">
        <h1 className="text-2xl font-bold">Your Cart</h1>
        <p className="mt-4 text-sm text-destructive">{error}</p>
        <Button className="mt-4" onClick={load}>
          Retry
        </Button>
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="container-page flex flex-col items-center py-20 text-center">
        <h1 className="text-2xl font-bold">Your Cart is empty</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Explore our catalog and add items you love to the cart.
        </p>
        <Link href="/products">
          <Button className="mt-6">Start shopping</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container-page py-8">
      <h1 className="text-2xl font-bold">Your Cart</h1>
      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_320px]">
        <ul className="space-y-4">
          {cart.items.map((item) => (
            <li
              key={item.id}
              className="flex gap-4 rounded-lg border border-border p-4"
              style={{ opacity: busyId === item.id ? 0.6 : 1 }}
            >
              {item.imageUrl ? (
                <Image
                  src={item.imageUrl}
                  alt={item.variantName}
                  width={96}
                  height={96}
                  className="h-24 w-24 shrink-0 rounded-md object-cover"
                />
              ) : (
                <div className="h-24 w-24 shrink-0 rounded-md bg-muted" />
              )}
              <div className="flex flex-1 flex-col gap-1">
                <p className="text-sm font-semibold">{item.productName}</p>
                <p className="text-xs text-muted-foreground">
                  {item.variantName} · SKU {item.sku}
                </p>
                <p className="text-sm font-medium">
                  {formatINR(item.effectiveUnitPrice)}
                  {Number(item.mrp) > Number(item.effectiveUnitPrice) && (
                    <span className="ml-2 text-xs text-muted-foreground line-through">{formatINR(item.mrp)}</span>
                  )}
                </p>
                {item.tierMinQuantity && (
                  <p className="text-xs font-medium text-emerald-600">
                    Tier price · {item.quantity}+ units at {formatINR(item.effectiveUnitPrice)} each
                  </p>
                )}
                {item.promotionName && Number(item.promoDiscount) > 0 && (
                  <p className="text-xs font-medium text-success">
                    {item.promotionName} · −{formatINR(item.promoDiscount)}
                  </p>
                )}
                {!item.inStock && (
                  <p className="text-xs font-medium text-destructive">Out of stock — remove to continue.</p>
                )}
                <div className="mt-1 flex items-center gap-3">
                  <div className="flex items-center rounded-md border border-input">
                    <button
                      type="button"
                      aria-label="Decrease quantity"
                      disabled={busyId === item.id}
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      className="h-8 w-8 transition-colors hover:bg-accent disabled:opacity-40"
                    >
                      &#8722;
                    </button>
                    <span className="w-8 text-center text-sm">{item.quantity}</span>
                    <button
                      type="button"
                      aria-label="Increase quantity"
                      disabled={busyId === item.id}
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      className="h-8 w-8 transition-colors hover:bg-accent disabled:opacity-40"
                    >
                      +
                    </button>
                  </div>
                  {item.priceChanged && (
                    <span className="text-xs font-medium text-warning">Price changed since added</span>
                  )}
                  <button
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() => removeItem(item.id)}
                    className="ml-auto text-xs font-medium text-muted-foreground underline-offset-2 hover:text-destructive hover:underline"
                  >
                    Remove
                  </button>
                </div>
              </div>
              <p className="text-sm font-semibold">{formatINR(item.lineTotal)}</p>
            </li>
          ))}
        </ul>

        <aside className="h-fit rounded-lg border border-border p-6">
          <h2 className="text-lg font-semibold">Order summary</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Items ({cart.totals.itemCount})</dt>
              <dd>{formatINR(cart.totals.subtotal)}</dd>
            </div>
            {Number(cart.totals.discount) > 0 && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Promo discount</dt>
                <dd className="font-medium text-success">−{formatINR(cart.totals.discount)}</dd>
              </div>
            )}
            {Number(cart.totals.savings) > 0 && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">You save</dt>
                <dd className="font-medium text-success">{formatINR(cart.totals.savings)}</dd>
              </div>
            )}
          </dl>
          <div className="mt-4 flex justify-between border-t border-border pt-4 text-base font-semibold">
            <span>Subtotal</span>
            <span>{formatINR(Number(cart.totals.subtotal) - Number(cart.totals.discount))}</span>
          </div>
          <Link href="/checkout" className="mt-6 block">
            <Button className="w-full">Proceed to Checkout</Button>
          </Link>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Free shipping on orders over ₹499 · COD available.
          </p>
          <button
            type="button"
            disabled={busyId === "__cart__"}
            onClick={clearCart}
            className="mt-4 w-full text-center text-xs text-muted-foreground underline underline-offset-2 hover:text-destructive"
          >
            Clear cart
          </button>
        </aside>
      </div>
    </div>
  );
}