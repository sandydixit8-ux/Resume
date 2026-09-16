"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Skeleton } from "@nexus/ui";
import type { OrderSummaryDto } from "@nexus/contracts";
import { ApiClientError, adminOrdersApi } from "@/lib/api";
import { RequireAuth } from "@/components/require-auth";

const FILTER = ["ALL", "CONFIRMED", "PROCESSING", "PACKED", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"];

const STATUS_VARIANT: Record<string, "default" | "destructive" | "success" | "outline"> = {
  CANCELLED: "destructive",
  DELIVERED: "success",
  CONFIRMED: "outline",
  PROCESSING: "default",
  PACKED: "outline",
  SHIPPED: "default",
  OUT_FOR_DELIVERY: "default",
};

function OrdersPageInner() {
  const [orders, setOrders] = useState<OrderSummaryDto[]>([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const result = await adminOrdersApi.listOrders({
        status: statusFilter === "ALL" ? undefined : statusFilter,
        page,
        pageSize: 20,
      });
      setOrders(result.data);
      setTotal(result.meta.total ?? 0);
    } catch (err) {
      setError(err instanceof ApiClientError || err instanceof Error ? err.message : "Failed to load orders");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CardTitle>Orders</CardTitle>
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            aria-label="Filter by status"
          >
            {FILTER.map((s) => (
              <option key={s} value={s}>
                {s === "ALL" ? "All statuses" : s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      {!error && total > 0 && <p className="mt-2 text-xs text-muted-foreground">{total} order{total === 1 ? "" : "s"}</p>}

      <Card className="mt-4">
        <CardHeader />
        <CardContent className="pt-0">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : orders.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No orders{statusFilter !== "ALL" ? ` in ${statusFilter}` : ""}.</p>
          ) : (
            <ul className="divide-y divide-border">
              {orders.map((order) => (
                <li key={order.id}>
                  <Link href={`/orders/${order.id}`} className="flex items-center justify-between py-3 hover:bg-muted/40">
                    <div>
                      <p className="text-sm font-semibold">{order.orderNumber}</p>
                      <p className="text-xs text-muted-foreground">
                        {order.updatedAt ? new Date(order.updatedAt).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : ""} · {order.itemCount} item{order.itemCount === 1 ? "" : "s"} · {order.customerName}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 text-right">
                      <span className="text-sm font-semibold">₹{Number(order.grandTotal).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                      <Badge variant={STATUS_VARIANT[order.status] ?? "default"}>{order.status}</Badge>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {total > 20 && (
        <div className="mt-4 flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">Page {page}</span>
          <Button variant="outline" size="sm" disabled={orders.length < 20} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

export default function OrdersPage() {
  return (
    <RequireAuth>
      <OrdersPageInner />
    </RequireAuth>
  );
}