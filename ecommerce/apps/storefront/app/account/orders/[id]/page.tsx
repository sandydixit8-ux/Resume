"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@nexus/ui";
import type { OrderDto } from "@nexus/contracts";
import { getStoredToken, ordersApi } from "@/lib/api";
import { formatINR } from "@/lib/format";

const CANCELLABLE = new Set(["PLACED", "PAYMENT_PENDING", "CONFIRMED"]);

export default function AccountOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<OrderDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!getStoredToken()) {
      router.replace("/login?redirect=/account/orders");
      return;
    }
    ordersApi
      .getMyOrder(id)
      .then(setOrder)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load order"))
      .finally(() => setLoading(false));
  }, [id, router]);

  const handleCancel = async () => {
    if (!order || !window.confirm("Cancel this order?")) return;
    setCancelling(true);
    try {
      const updated = await ordersApi.cancelMyOrder(order.id, "Cancelled by customer");
      setOrder(updated);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Cancel failed");
    } finally {
      setCancelling(false);
    }
  };

  if (loading) return <div className="container-page py-8"><p className="text-sm text-muted-foreground">Loading…</p></div>;
  if (error) return <div className="container-page py-8"><p className="text-sm text-destructive">{error}</p></div>;
  if (!order) return null;

  return (
    <div className="container-page max-w-3xl py-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{order.orderNumber}</h1>
          <p className="text-sm text-muted-foreground">
            Placed on {new Date(order.placedAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <span className="rounded-full border border-border px-3 py-1 text-sm font-medium">{order.status}</span>
      </div>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <div className="rounded-lg border border-border p-4">
          <h2 className="text-sm font-semibold text-muted-foreground">Shipping address</h2>
          <p className="mt-1 text-sm leading-relaxed">
            {order.shippingAddress.fullName}<br />
            {order.shippingAddress.line1}{order.shippingAddress.line2 ? <>, {order.shippingAddress.line2}</> : ""}<br />
            {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.pincode}
          </p>
        </div>
        <div className="rounded-lg border border-border p-4">
          <h2 className="text-sm font-semibold text-muted-foreground">Payment</h2>
          {order.payment ? (
            <p className="mt-1 text-sm">
              {order.payment.method} — <span className="font-medium">{order.payment.status}</span>
              {order.payment.providerPaymentId && <span className="ml-1 text-xs text-muted-foreground">({order.payment.providerPaymentId})</span>}
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">No payment record</p>
          )}
        </div>
      </div>

      <h2 className="mt-6 text-sm font-semibold text-muted-foreground">Items</h2>
      <ul className="mt-2 divide-y divide-border rounded-lg border border-border">
        {order.items.map((item) => (
          <li key={item.id} className="flex items-center justify-between p-4 text-sm">
            <div>
              <p className="font-medium">{item.name}</p>
              <p className="text-xs text-muted-foreground">
                {item.sku} × {item.quantity}
              </p>
            </div>
            <span className="font-medium">{formatINR(item.lineTotal)}</span>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-col items-end gap-1 border-t border-border pt-4 text-sm">
        <div className="flex justify-between gap-8"><span className="text-muted-foreground">Subtotal</span><span>{formatINR(order.totals.subtotal)}</span></div>
        <div className="flex justify-between gap-8"><span className="text-muted-foreground">Shipping</span><span>{Number(order.totals.shippingTotal) === 0 ? "Free" : formatINR(order.totals.shippingTotal)}</span></div>
        <div className="flex justify-between gap-8 text-base font-semibold"><span>Total</span><span>{formatINR(order.totals.grandTotal)}</span></div>
      </div>

      {order.statusHistory.length > 0 && (
        <>
          <h2 className="mt-8 text-sm font-semibold text-muted-foreground">Status history</h2>
          <ol className="mt-2 space-y-1 border-l-2 border-border pl-4 text-xs">
            {order.statusHistory.map((entry) => (
              <li key={entry.id} className="relative -ml-[1.25rem]">
                <span className="inline-block h-2 w-2 rounded-full bg-primary" />
                <span className="ml-2 font-medium">{entry.toStatus}</span>
                {entry.fromStatus && <span className="text-muted-foreground"> (from {entry.fromStatus})</span>}
                <span className="ml-1 text-muted-foreground">
                  {new Date(entry.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
                {entry.reason && <span className="block text-muted-foreground">Reason: {entry.reason}</span>}
              </li>
            ))}
          </ol>
        </>
      )}

      <div className="mt-8 flex items-center gap-3">
        <Link href="/account/orders">
          <Button variant="outline">Back to orders</Button>
        </Link>
        {CANCELLABLE.has(order.status) && (
          <Button variant="destructive" onClick={handleCancel} disabled={cancelling}>
            {cancelling ? "Cancelling…" : "Cancel order"}
          </Button>
        )}
      </div>
    </div>
  );
}