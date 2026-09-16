"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Alert, Badge, Button, Card, CardContent, CardHeader, CardTitle, Skeleton } from "@nexus/ui";
import type { OrderDto } from "@nexus/contracts";
import { ApiClientError, adminOrdersApi } from "@/lib/api";
import { RequireAuth } from "@/components/require-auth";

const TRANSITIONS: Record<string, string[]> = {
  PLACED: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["PACKED", "CANCELLED"],
  PACKED: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["OUT_FOR_DELIVERY"],
  OUT_FOR_DELIVERY: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
};

function AdminOrderDetailInner() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<OrderDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const inr = (value: string | number): string =>
    Number(value).toLocaleString("en-IN", { minimumFractionDigits: 2 });

  const load = useCallback(async () => {
    setError("");
    try {
      setOrder(await adminOrdersApi.getOrder(id));
    } catch (err) {
      setError(err instanceof ApiClientError || err instanceof Error ? err.message : "Failed to load order");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const transition = async (toStatus: string) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      setOrder(await adminOrdersApi.updateStatus(id, toStatus));
      setNotice(`Order moved to ${toStatus}`);
    } catch (err) {
      setError(err instanceof ApiClientError || err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (error && !order) {
    return (
      <div>
        <Alert variant="destructive">{error}</Alert>
        <Link href="/orders"><Button variant="outline" className="mt-4">Back to orders</Button></Link>
      </div>
    );
  }

  if (!order) return null;

  const nextStatuses = TRANSITIONS[order.status] ?? [];

  return (
    <div>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">{order.orderNumber}</h1>
          <p className="text-sm text-muted-foreground">
            {order.shippingAddress.fullName} · {order.shippingAddress.phone} · {new Date(order.placedAt).toLocaleString("en-IN", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <Badge variant={order.status === "CANCELLED" ? "destructive" : order.status === "DELIVERED" ? "success" : "default"}>
          {order.status}
        </Badge>
      </div>

      {error && <Alert variant="destructive" className="mt-3">{error}</Alert>}
      {notice && <Alert variant="success" className="mt-3">{notice}</Alert>}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Move to:</span>
        {nextStatuses.length === 0 ? (
          <span className="text-sm text-muted-foreground">No further transitions (terminal status)</span>
        ) : (
          nextStatuses.map((status) => (
            <Button
              key={status}
              size="sm"
              variant={status === "CANCELLED" ? "destructive" : "default"}
              disabled={busy}
              onClick={() => transition(status)}
            >
              {status}
            </Button>
          ))
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Shipping address</CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-relaxed">
            <p className="font-medium">{order.shippingAddress.fullName}</p>
            <p>{order.shippingAddress.line1}{order.shippingAddress.line2 ? <>, {order.shippingAddress.line2}</> : ""}</p>
            <p>{order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.pincode}</p>
            <p>Country: {order.shippingAddress.country}</p>
            <p>Phone: {order.shippingAddress.phone}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {order.payment ? (
              <dl className="space-y-1">
                <div className="flex justify-between"><dt className="text-muted-foreground">Method</dt><dd>{order.payment.method}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Status</dt><dd>{order.payment.status}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Provider</dt><dd>{order.payment.provider}</dd></div>
                {order.payment.providerPaymentId && <div className="flex justify-between"><dt className="text-muted-foreground">Ref</dt><dd className="font-mono text-xs">{order.payment.providerPaymentId}</dd></div>}
              </dl>
            ) : (
              <p className="text-muted-foreground">No payment record</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Items</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-border">
            {order.items.map((item) => (
              <li key={item.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <p className="font-medium">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.sku} · {item.variantName}</p>
                </div>
                <div className="text-right">
                  <p>₹{inr(item.unitPrice)} × {item.quantity}</p>
                  <p className="font-semibold">₹{inr(item.lineTotal)}</p>
                </div>
              </li>
            ))}
          </ul>
          <dl className="mt-3 space-y-1 border-t border-border pt-3 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd>₹{inr(order.totals.subtotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Shipping</dt><dd>{Number(order.totals.shippingTotal) === 0 ? "Free" : `₹${inr(order.totals.shippingTotal)}`}</dd></div>
            <div className="flex justify-between font-semibold"><dt>Grand total</dt><dd>₹{inr(order.totals.grandTotal)}</dd></div>
          </dl>
        </CardContent>
      </Card>

      {order.statusHistory.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Status history</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="border-l-2 border-border pl-4 text-xs">
              {order.statusHistory.map((entry) => (
                <li key={entry.id} className="relative pb-3">
                  <span className="absolute -left-[1.28rem] top-0 inline-block h-2 w-2 rounded-full bg-primary" />
                  <span className="font-medium">{entry.toStatus}</span>
                  {entry.fromStatus && <span className="text-muted-foreground"> (from {entry.fromStatus})</span>}
                  <span className="ml-1 text-muted-foreground">
                    {new Date(entry.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                  {entry.reason && <span className="block text-muted-foreground">Reason: {entry.reason}</span>}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      <div className="mt-6">
        <Link href="/orders">
          <Button variant="outline">Back to orders</Button>
        </Link>
      </div>
    </div>
  );
}

export default function AdminOrderDetailPage() {
  return (
    <RequireAuth>
      <AdminOrderDetailInner />
    </RequireAuth>
  );
}