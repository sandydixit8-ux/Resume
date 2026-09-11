"use client";

import { useState } from "react";
import Link from "next/link";
import { Phone, MessageCircle, CalendarClock, Receipt, ShoppingCart, FileText } from "lucide-react";
import type { Customer, Activity, Order, Quotation, Invoice } from "@/types/supabase";
import { Badge, orderStatusTone, humanize, invoiceStatusTone, quoteStatusTone } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KpiCard } from "@/components/ui/kpi-card";
import { formatMoney, formatDate, formatDateTime } from "@/lib/utils";
import type { CustomerSummary } from "@/lib/data/customers";

const ACTIVITY_ICON: Record<string, typeof Phone> = {
  call: Phone,
  whatsapp: MessageCircle,
  email: Receipt,
  meeting: CalendarClock,
  visit: ShoppingCart,
  note: FileText,
};

export function CustomerDetailClient({
  customer,
  summary,
  activities,
  orders,
  quotations,
  invoices,
  ownerName,
}: {
  customer: Customer;
  summary: CustomerSummary;
  activities: Activity[];
  orders: Order[];
  quotations: Quotation[];
  invoices: Invoice[];
  ownerName: string | null;
}) {
  const [tab, setTab] = useState("overview");

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[var(--border)] bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-base font-bold text-emerald-700">
              {customer.name.slice(0, 2).toUpperCase()}
            </span>
            <div>
              <h2 className="text-base font-semibold">{customer.name}</h2>
              <p className="text-xs text-muted-foreground">
                {customer.customer_no}
                {customer.city ? ` · ${customer.city}` : ""} · Owner: {ownerName ?? "Unassigned"}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <Badge tone="success">Customer</Badge>
                {customer.opt_in_comms ? <Badge tone="info">Opted in for WhatsApp</Badge> : <Badge>No marketing consent</Badge>}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <a
              href={customer.mobile ? `tel:${customer.mobile}` : undefined}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--input)] bg-white px-2.5 text-xs font-medium text-foreground hover:bg-zinc-50"
            >
              <Phone className="h-3.5 w-3.5" /> Call
            </a>
            <span
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--input)] bg-white px-2.5 text-xs font-medium text-foreground"
              title="Coming soon"
            >
              <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Total orders" value={summary.totalOrders} />
        <KpiCard label="Total revenue" value={formatMoney(summary.totalRevenue)} />
        <KpiCard label="Outstanding" value={formatMoney(summary.outstanding)} hint={summary.outstanding > 0 ? "to collect" : "all clear"} />
        <KpiCard label="Open opps" value={summary.openOpportunities} />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="activities">Activities</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="quotes">Quotes</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-[var(--border)] bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold">Contact details</h3>
              <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                {[
                  ["Mobile", customer.mobile ?? "-"],
                  ["Email", customer.email ?? "-"],
                  ["WhatsApp", customer.whatsapp_number ?? "-"],
                  ["Address", [customer.address, customer.city, customer.state, customer.pincode].filter(Boolean).join(", ") || "-"],
                  ["GSTIN", customer.gstin ?? "-"],
                  ["Last order", summary.lastOrder ? formatDate(summary.lastOrder) : "-"],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{k}</dt>
                    <dd className="mt-0.5">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold">Recent activity</h3>
              {activities.length === 0 ? (
                <p className="text-xs text-muted-foreground">No activity recorded yet.</p>
              ) : (
                <ul className="space-y-2">
                  {activities.slice(0, 6).map((a) => {
                    const Icon = ACTIVITY_ICON[a.activity_type] ?? FileText;
                    return (
                      <li key={a.id} className="flex items-start gap-2">
                        <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <p className="truncate text-xs">{a.summary}</p>
                          <p className="text-[11px] text-muted-foreground">{formatDateTime(a.performed_at)}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="activities">
          {activities.length === 0 ? (
            <p className="rounded-xl border border-[var(--border)] bg-white p-6 text-center text-sm text-muted-foreground">
              No activities yet.
            </p>
          ) : (
            <div className="rounded-xl border border-[var(--border)] bg-white shadow-sm">
              <ul className="divide-y divide-[var(--border)]">
                {activities.slice(0, 30).map((a) => {
                  const Icon = ACTIVITY_ICON[a.activity_type] ?? FileText;
                  return (
                    <li key={a.id} className="flex items-start gap-3 px-4 py-3">
                      <Icon className="mt-0.5 h-4 w-4 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm">{a.summary}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {humanize(a.activity_type)} · {formatDateTime(a.performed_at)}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </TabsContent>

        <TabsContent value="orders">
          <OrdersTable orders={orders} />
        </TabsContent>
        <TabsContent value="quotes">
          <QuotesTable quotations={quotations} />
        </TabsContent>
        <TabsContent value="invoices">
          <InvoicesTable invoices={invoices} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function OrdersTable({ orders }: { orders: Order[] }) {
  if (orders.length === 0) return <p className="rounded-xl border border-[var(--border)] bg-white p-6 text-center text-sm text-muted-foreground">No orders for this customer.</p>;
  return (
    <div className="rounded-xl border border-[var(--border)] bg-white shadow-sm">
      <ul className="divide-y divide-[var(--border)]">
        {orders.map((o) => (
          <li key={o.id} className="flex items-center justify-between gap-2 px-4 py-3">
            <div>
              <Link href={`/orders/${o.id}`} className="text-sm font-medium hover:underline">
                {o.order_no}
              </Link>
              <p className="text-[11px] text-muted-foreground">{formatDate(o.created_at)}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold tabular-nums">{formatMoney(o.total)}</p>
              <Badge tone={orderStatusTone(o.status)}>{humanize(o.status)}</Badge>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function QuotesTable({ quotations }: { quotations: Quotation[] }) {
  if (quotations.length === 0) return <p className="rounded-xl border border-[var(--border)] bg-white p-6 text-center text-sm text-muted-foreground">No quotations for this customer.</p>;
  return (
    <div className="rounded-xl border border-[var(--border)] bg-white shadow-sm">
      <ul className="divide-y divide-[var(--border)]">
        {quotations.map((q) => (
          <li key={q.id} className="flex items-center justify-between gap-2 px-4 py-3">
            <div>
              <p className="text-sm font-medium">{q.quote_no}</p>
              <p className="text-[11px] text-muted-foreground">{formatDate(q.date)}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold tabular-nums">{formatMoney(q.total)}</p>
              <Badge tone={quoteStatusTone(q.status)}>{humanize(q.status)}</Badge>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function InvoicesTable({ invoices }: { invoices: Invoice[] }) {
  if (invoices.length === 0) return <p className="rounded-xl border border-[var(--border)] bg-white p-6 text-center text-sm text-muted-foreground">No invoices for this customer.</p>;
  return (
    <div className="rounded-xl border border-[var(--border)] bg-white shadow-sm">
      <ul className="divide-y divide-[var(--border)]">
        {invoices.map((inv) => (
          <li key={inv.id} className="flex items-center justify-between gap-2 px-4 py-3">
            <div>
              <p className="text-sm font-medium">{inv.invoice_no}</p>
              <p className="text-[11px] text-muted-foreground">{formatDate(inv.date)}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold tabular-nums">{formatMoney(inv.total)}</p>
              <Badge tone={invoiceStatusTone(inv.status)}>{humanize(inv.status)}</Badge>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}