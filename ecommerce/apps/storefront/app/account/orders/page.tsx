"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@nexus/ui";
import { getStoredToken, ordersApi } from "@/lib/api";
import { formatINR } from "@/lib/format";
import type { OrderSummaryDto } from "@nexus/contracts";

const STATUS_STYLES: Record<string, string> = {
  CANCELLED: "text-destructive",
  DELIVERED: "text-success",
  SHIPPED: "text-primary",
  OUT_FOR_DELIVERY: "text-primary",
};

export default function AccountOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<OrderSummaryDto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getStoredToken()) {
      router.replace("/login?redirect=/account/orders");
      return;
    }
    setLoading(true);
    ordersApi
      .listMyOrders({ page, pageSize: 10 })
      .then((result) => {
        setOrders(result.data);
        setTotal(result.meta.total);
        setError(null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load orders"))
      .finally(() => setLoading(false));
  }, [page, router]);

  return (
    <div className="container-page max-w-4xl py-8">
      <h1 className="text-2xl font-bold">My Orders</h1>

      {loading && <p className="mt-4 text-sm text-muted-foreground">Loading orders…</p>}

      {!loading && error && (
        <p className="mt-4 text-sm text-destructive">{error}</p>
      )}

      {!loading && !error && orders.length === 0 && (
        <div className="mt-12 flex flex-col items-center text-center">
          <p className="text-muted-foreground">You haven&apos;t placed any orders yet.</p>
          <Link href="/products">
            <Button className="mt-4">Start shopping</Button>
          </Link>
        </div>
      )}

      {!loading && !error && orders.length > 0 && (
        <>
          <p className="mt-2 text-sm text-muted-foreground">{total} order{total === 1 ? "" : "s"}</p>
          <ul className="mt-4 space-y-3">
            {orders.map((order) => (
              <li key={order.id} className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
                <div>
                  <Link href={`/account/orders/${order.id}`} className="text-sm font-semibold hover:text-primary">
                    {order.orderNumber}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {new Date(order.placedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} · {order.itemCount} item{order.itemCount === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{formatINR(order.grandTotal)}</p>
                  <p className={`text-xs font-medium ${STATUS_STYLES[order.status] ?? "text-muted-foreground"}`}>
                    {order.status}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          {total > 10 && (
            <div className="mt-4 flex items-center justify-center gap-3">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">Page {page}</span>
              <Button variant="outline" size="sm" disabled={orders.length < 10} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}