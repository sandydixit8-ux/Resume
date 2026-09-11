import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getDelivery } from "@/lib/data/sales";
import { Badge, deliveryStatusTone, humanize } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Delivery" };
export const dynamic = "force-dynamic";

export default async function DeliveryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getDelivery(id);
  if (!detail) notFound();
  const d = detail.delivery;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[var(--border)] bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold">{d.tracking_no ?? d.id.slice(0, 8)}</h2>
              <Badge tone={deliveryStatusTone(d.status)}>{humanize(d.status)}</Badge>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {detail.customer_name} ·{" "}
              <Link href={`/orders/${d.order_id}`} className="underline hover:text-foreground">
                order {detail.order_no}
              </Link>
            </p>
            {(d.driver_name || d.vehicle_no) && (
              <p className="mt-1 text-xs text-muted-foreground">
                {d.driver_name ?? "Driver unassigned"}
                {d.vehicle_no ? ` · ${d.vehicle_no}` : ""}
              </p>
            )}
          </div>
        </div>
      </div>

      {(d.address || d.city) && (
        <div className="rounded-xl border border-[var(--border)] bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold">Delivery address</h3>
          <p className="mt-1 text-sm text-muted-foreground">{[d.address, d.city].filter(Boolean).join(", ")}</p>
        </div>
      )}

      <div className="rounded-xl border border-[var(--border)] bg-white shadow-sm">
        <div className="border-b border-[var(--border)] px-4 py-3">
          <h3 className="text-sm font-semibold">Timeline</h3>
        </div>
        {detail.events.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">No events recorded.</p>
        ) : (
          <ol className="space-y-4 px-4 py-4">
            {detail.events.map((e) => (
              <li key={e.id} className="flex items-start gap-3">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--primary)]" />
                <div>
                  <p className="text-sm">
                    <span className="font-medium">{humanize(e.status)}</span>
                    {e.note ? <span className="text-muted-foreground"> — {e.note}</span> : null}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{formatDateTime(e.at)}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}