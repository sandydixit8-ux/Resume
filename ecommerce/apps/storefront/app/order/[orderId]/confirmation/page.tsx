"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@nexus/ui";
import type { PlaceOrderResult } from "@nexus/contracts";
import { checkoutApi } from "@/lib/api";
import { formatINR } from "@/lib/format";

function ConfirmationInner() {
  const params = useSearchParams();
  const session = params.get("session");
  const [result, setResult] = useState<PlaceOrderResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) {
      setError("Missing session identifier");
      return;
    }
    checkoutApi
      .findSession(session)
      .then(setResult)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load order"));
  }, [session]);

  if (error) {
    return (
      <div className="container-page flex flex-col items-center py-20 text-center">
        <h1 className="text-2xl font-bold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        <Link href="/products">
          <Button className="mt-6">Back to shop</Button>
        </Link>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="container-page py-10">
        <p className="text-sm text-muted-foreground">Loading order details…</p>
      </div>
    );
  }

  const { order, payment } = result;

  return (
    <div className="container-page max-w-3xl py-10">
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <p className="text-sm font-medium text-success">Order placed successfully</p>
        <h1 className="mt-2 text-2xl font-bold">{order.orderNumber}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Status: <span className="font-medium">{order.status}</span>
        </p>

        <div className="mt-6 grid gap-6 text-left sm:grid-cols-2">
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground">Payment</h2>
            <p className="mt-1 text-sm font-medium">
              {payment.method} — {payment.status}
            </p>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground">Shipping to</h2>
            <p className="mt-1 text-sm leading-relaxed">
              {order.shippingAddress.fullName}
              <br />
              {order.shippingAddress.line1}
              {order.shippingAddress.line2 ? <>, {order.shippingAddress.line2}</> : ""}
              <br />
              {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.pincode}
            </p>
          </div>
        </div>

        <div className="mt-6 border-t border-border pt-6 text-left">
          <h2 className="text-sm font-semibold text-muted-foreground">Items</h2>
          <ul className="mt-2 divide-y divide-border">
            {order.items.map((item) => (
              <li key={item.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <p className="font-medium">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.sku} × {item.quantity} · {formatINR(item.unitPrice)} each
                  </p>
                  {item.promotionName && Number(item.promoDiscount) > 0 && (
                    <p className="text-xs font-medium text-success">
                      {item.promotionName} · −{formatINR(item.promoDiscount)}
                    </p>
                  )}
                </div>
                <span className="font-medium">{formatINR(item.lineTotal)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-6 space-y-2 border-t border-border pt-6 text-sm">
          {Number(order.totals.discountTotal) > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Promo discount</span>
              <span className="font-medium text-success">−{formatINR(order.totals.discountTotal)}</span>
            </div>
          )}
          <div className="flex items-center justify-between text-base font-semibold">
            <span>Total</span>
            <span>{formatINR(order.totals.grandTotal)}</span>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/products">
            <Button variant="outline">Continue shopping</Button>
          </Link>
          <Link href="/account/orders">
            <Button>View my orders</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function OrderConfirmationPage() {
  return (
    <Suspense fallback={<div className="container-page py-10"><p className="text-sm text-muted-foreground">Loading…</p></div>}>
      <ConfirmationInner />
    </Suspense>
  );
}