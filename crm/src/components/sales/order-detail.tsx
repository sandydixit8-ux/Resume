"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, Package, Truck, X } from "lucide-react";
import type { OrderDetail } from "@/lib/data/sales";
import { Badge, orderStatusTone, paymentStatusTone, deliveryStatusTone, humanize } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { updateOrderStatus, cancelOrder } from "@/lib/actions/sales";
import { formatMoney, formatDate } from "@/lib/utils";

const NEXT_ACTIONS: Record<string, { label: string; status: string }[]> = {
  DRAFT: [{ label: "Confirm order", status: "CONFIRMED" }],
  CONFIRMED: [{ label: "Start processing", status: "PROCESSING" }],
  PROCESSING: [{ label: "Mark packed", status: "PACKED" }],
  PACKED: [{ label: "Dispatch & deduct stock", status: "DISPATCHED" }],
  DISPATCHED: [{ label: "Out for delivery", status: "OUT_FOR_DELIVERY" }],
  OUT_FOR_DELIVERY: [{ label: "Mark delivered", status: "DELIVERED" }],
  DELIVERED: [],
  CANCELLED: [],
  RETURNED: [],
};

const CANCELABLE = ["DRAFT", "CONFIRMED", "PROCESSING", "PACKED"];

export function OrderDetailClient({ detail }: { detail: OrderDetail }) {
  const router = useRouter();
  const { order, items, delivery } = detail;
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function changeStatus(status: string) {
    setBusy(true);
    setError(null);
    const res = await updateOrderStatus(order.id, status);
    setBusy(false);
    if (res?.success) {
      router.refresh();
    } else {
      setError("error" in res ? res.error : "Could not update the order.");
    }
  }

  async function cancel() {
    setBusy(true);
    setError(null);
    const res = await cancelOrder(order.id);
    setBusy(false);
    if (res?.success) {
      router.refresh();
    } else {
      setError("error" in res ? res.error : "Could not cancel the order.");
    }
  }

  const actions = NEXT_ACTIONS[order.status] ?? [];
  const isCancelable = CANCELABLE.includes(order.status);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[var(--border)] bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold">{order.order_no}</h2>
              <Badge tone={orderStatusTone(order.status)}>{humanize(order.status)}</Badge>
              <Badge tone={paymentStatusTone(order.payment_status)}>Payment {humanize(order.payment_status)}</Badge>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {detail.customerName ?? "No customer"}
              {detail.quoteNo ? ` · from quote ${detail.quoteNo}` : ""}
              {detail.salespersonName ? ` · ${detail.salespersonName}` : ""}
              {order.delivery_date ? ` · deliver by ${formatDate(order.delivery_date)}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {actions.map((a) => (
              <Button key={a.status} size="sm" onClick={() => changeStatus(a.status)} loading={busy}>
                <ChevronRight className="h-3.5 w-3.5" /> {a.label}
              </Button>
            ))}
            {isCancelable ? (
              <Button size="sm" variant="outline" onClick={cancel} loading={busy}>
                <X className="h-3.5 w-3.5" /> Cancel order
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-[var(--border)] bg-white p-4 shadow-sm">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Total</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{formatMoney(order.total)}</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-white p-4 shadow-sm">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Subtotal</p>
          <p className="mt-1 text-sm font-medium tabular-nums">{formatMoney(order.subtotal)}</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-white p-4 shadow-sm">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">GST</p>
          <p className="mt-1 text-sm font-medium tabular-nums">{formatMoney(order.tax_amount)}</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-white p-4 shadow-sm">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Items</p>
          <p className="mt-1 text-sm font-medium">{items.length}</p>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-white shadow-sm">
        <div className="border-b border-[var(--border)] px-4 py-3">
          <h3 className="text-sm font-semibold">Line items</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2">Item</th>
                <th className="px-4 py-2 text-right">Qty</th>
                <th className="hidden px-4 py-2 text-right sm:table-cell">Rate</th>
                <th className="hidden px-4 py-2 text-right sm:table-cell">GST %</th>
                <th className="px-4 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {items.map((it) => (
                <tr key={it.id}>
                  <td className="px-4 py-2 font-medium">{it.product_name}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{it.quantity}</td>
                  <td className="hidden px-4 py-2 text-right tabular-nums sm:table-cell">{formatMoney(it.unit_price)}</td>
                  <td className="hidden px-4 py-2 text-right tabular-nums sm:table-cell">{it.tax_rate}%</td>
                  <td className="px-4 py-2 text-right font-medium tabular-nums">{formatMoney(it.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {(order.delivery_address || order.delivery_city || order.notes) ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {(order.delivery_address || order.delivery_city) ? (
            <div className="rounded-xl border border-[var(--border)] bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Delivery details</h3>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {[order.delivery_address, order.delivery_city].filter(Boolean).join(", ") || "No delivery address set."}
              </p>
              {delivery ? (
                <div className="mt-3 flex items-center gap-2 text-xs">
                  <Badge tone={deliveryStatusTone(delivery.status)}>{humanize(delivery.status)}</Badge>
                  {delivery.driver_name ? <span className="text-muted-foreground">{delivery.driver_name}</span> : null}
                </div>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">A delivery record is created when the order is dispatched.</p>
              )}
            </div>
          ) : null}
          {order.notes ? (
            <div className="rounded-xl border border-[var(--border)] bg-white p-4 shadow-sm">
              <h3 className="text-sm font-semibold">Notes</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{order.notes}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      {order.status === "DISPATCHED" ? (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Stock has been deducted and a delivery record created. Mark it &quot;out for delivery&quot; once handed to the courier.
        </div>
      ) : null}
      {order.status === "DELIVERED" ? (
        <div className="flex items-start gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          <Package className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Order delivered. Invoicing and payments are part of the next phase.
        </div>
      ) : null}
    </div>
  );
}
