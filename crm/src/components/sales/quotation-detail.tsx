"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send, Check, Eye, X, Clock, ArrowRight } from "lucide-react";
import type { QuotationDetail } from "@/lib/data/sales";
import { Badge, quoteStatusTone, humanize } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { updateQuotationStatus, convertQuotationToOrder } from "@/lib/actions/sales";
import { formatMoney, formatDate } from "@/lib/utils";

const NEXT_ACTIONS: Record<string, { label: string; status: string; icon: typeof Send }[]> = {
  DRAFT: [{ label: "Mark as sent", status: "SENT", icon: Send }],
  SENT: [
    { label: "Mark viewed", status: "VIEWED", icon: Eye },
    { label: "Mark expired", status: "EXPIRED", icon: Clock },
    { label: "Reject", status: "REJECTED", icon: X },
  ],
  VIEWED: [
    { label: "Accept", status: "ACCEPTED", icon: Check },
    { label: "Reject", status: "REJECTED", icon: X },
    { label: "Mark expired", status: "EXPIRED", icon: Clock },
  ],
  ACCEPTED: [],
  REJECTED: [],
  EXPIRED: [],
  CONVERTED: [],
};

export function QuotationDetailClient({ detail }: { detail: QuotationDetail }) {
  const router = useRouter();
  const { quotation, items } = detail;
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function changeStatus(status: string) {
    setBusy(true);
    setError(null);
    const res = await updateQuotationStatus(quotation.id, status);
    setBusy(false);
    if (res?.success) {
      router.refresh();
    } else {
      setError("error" in res ? res.error : "Could not update the quotation.");
    }
  }

  async function convert() {
    setBusy(true);
    setError(null);
    const res = await convertQuotationToOrder(quotation.id);
    setBusy(false);
    if (res?.success && "id" in res) {
      router.push(`/orders/${res.id}`);
    } else {
      setError("error" in res ? res.error : "Could not convert to order.");
    }
  }

  const actions = NEXT_ACTIONS[quotation.status] ?? [];

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[var(--border)] bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold">{quotation.quote_no}</h2>
              <Badge tone={quoteStatusTone(quotation.status)}>{humanize(quotation.status)}</Badge>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {detail.customerName ?? "No customer"} · dated {formatDate(quotation.date)}
              {quotation.valid_until ? ` · valid until ${formatDate(quotation.valid_until)}` : ""}
              {detail.salespersonName ? ` · ${detail.salespersonName}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {actions.map((a) => (
              <Button key={a.status} size="sm" onClick={() => changeStatus(a.status)} loading={busy} variant={a.status === "REJECTED" ? "outline" : "primary"}>
                <a.icon className="h-3.5 w-3.5" /> {a.label}
              </Button>
            ))}
            {quotation.status === "ACCEPTED" ? (
              <Button size="sm" onClick={convert} loading={busy}>
                <ArrowRight className="h-3.5 w-3.5" /> Convert to order
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
                <th className="hidden px-4 py-2 text-right sm:table-cell">Disc %</th>
                <th className="hidden px-4 py-2 text-right md:table-cell">GST %</th>
                <th className="px-4 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {items.map((it) => (
                <tr key={it.id}>
                  <td className="px-4 py-2 font-medium">{it.product_name}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{it.quantity}</td>
                  <td className="hidden px-4 py-2 text-right tabular-nums sm:table-cell">{formatMoney(it.unit_price)}</td>
                  <td className="hidden px-4 py-2 text-right tabular-nums sm:table-cell">{it.discount}%</td>
                  <td className="hidden px-4 py-2 text-right tabular-nums md:table-cell">{it.tax_rate}%</td>
                  <td className="px-4 py-2 text-right font-medium tabular-nums">{formatMoney(it.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end border-t border-[var(--border)] px-4 py-3">
          <div className="w-full max-w-[220px] space-y-1 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span className="tabular-nums">{formatMoney(quotation.subtotal)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Tax</span>
              <span className="tabular-nums">{formatMoney(quotation.tax_amount)}</span>
            </div>
            <div className="flex justify-between border-t border-[var(--border)] pt-1 font-semibold">
              <span>Total</span>
              <span className="tabular-nums">{formatMoney(quotation.total)}</span>
            </div>
          </div>
        </div>
      </div>

      {quotation.terms || quotation.notes ? (
        <div className="rounded-xl border border-[var(--border)] bg-white p-4 shadow-sm">
          {quotation.terms ? (
            <>
              <h3 className="text-sm font-semibold">Terms</h3>
              <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{quotation.terms}</p>
            </>
          ) : null}
          {quotation.notes ? (
            <>
              <h3 className="mt-3 text-sm font-semibold">Notes</h3>
              <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{quotation.notes}</p>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
