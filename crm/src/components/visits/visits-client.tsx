"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Footprints, MapPin, User, Plus, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { createVisit } from "@/lib/actions/crm";
import type { VisitRow } from "@/lib/data/visits";
import type { VisitCustomerOption } from "@/lib/data/visits";
import { Badge, visitStatusTone, humanize } from "@/components/ui/badge";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateTime } from "@/lib/utils";

const VISIT_ORDER = ["PLANNED", "STARTED", "COMPLETED", "MISSED", "CANCELLED"];

export function VisitsClient({
  visits,
  customers,
}: {
  visits: VisitRow[];
  customers: VisitCustomerOption[];
}) {
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);

  const groups = useMemo(() => {
    const map = new Map<string, VisitRow[]>();
    for (const v of visits) {
      const key = VISIT_ORDER.includes(v.status) ? v.status : "PLANNED";
      const arr = map.get(key) ?? [];
      arr.push(v);
      map.set(key, arr);
    }
    return [...map.entries()].sort((a, b) => VISIT_ORDER.indexOf(a[0]) - VISIT_ORDER.indexOf(b[0]));
  }, [visits]);

  return (
    <div className="space-y-4">
      {visits.length === 0 ? (
        <EmptyState
          icon={Footprints}
          title="No visits yet"
          description="Plan field visits to your customers and track check-ins from here."
          action={
            <button
              onClick={() => setSheetOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 py-2 text-xs font-medium text-white"
            >
              <Plus className="h-4 w-4" /> Create visit
            </button>
          }
        />
      ) : (
        groups.map(([status, items]) => (
          <section key={status}>
            <div className="mb-2 flex items-center gap-2 px-1">
              <h2 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{humanize(status)}</h2>
              <Badge tone={visitStatusTone(status)}>{items.length}</Badge>
            </div>
            <ul className="space-y-2">
              {items.map((v) => (
                <li key={v.id} className="rounded-xl border border-[var(--border)] bg-white p-3.5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{v.purpose}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                        <User className="h-3 w-3" />
                        {v.customer_id ? (
                          <Link href={`/customers/${v.customer_id}`} className="font-medium text-[var(--primary)] hover:underline">
                            {v.customer_name ?? "Customer"}
                          </Link>
                        ) : (
                          "No customer"
                        )}
                        {v.customer_mobile ? ` · ${v.customer_mobile}` : ""}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {formatDateTime(v.scheduled_at)}
                        {v.visit_by_name ? ` · by ${v.visit_by_name}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <Badge tone={visitStatusTone(v.status)}>{humanize(v.status)}</Badge>
                      {v.status === "PLANNED" ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--primary)]">
                          <CheckCircle2 className="h-3 w-3" /> Check in
                        </span>
                      ) : null}
                    </div>
                  </div>
                  {v.notes ? <p className="mt-2 text-xs text-muted-foreground">{v.notes}</p> : null}
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      <div className="flex justify-center">
        <Button variant="outline" size="sm" onClick={() => setSheetOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> Create visit
        </Button>
      </div>

      <CreateVisitSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        customers={customers}
        onSaved={() => {
          setSheetOpen(false);
          router.refresh();
        }}
      />
    </div>
  );
}

function CreateVisitSheet({
  open,
  onOpenChange,
  customers,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customers: VisitCustomerOption[];
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false);

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Create visit" description="Plan a field visit to a customer.">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          setBusy(true);
          const res = await createVisit(null, fd);
          setBusy(false);
          if (res?.success) {
            toast.success("Visit scheduled");
            onSaved();
          } else {
            toast.error(res?.error ?? "Could not schedule visit");
          }
        }}
      >
        <Field label="Customer" required>
          <Select name="customer_id" required defaultValue="">
            <option value="" disabled>
              Select a customer
            </option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.mobile ? ` · ${c.mobile}` : ""}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Date & time" required>
          <Input name="scheduled_at" type="datetime-local" required />
        </Field>
        <Field label="Purpose" required>
          <Textarea name="purpose" placeholder="e.g. Collect payment, show new catalogue" required maxLength={500} />
        </Field>
        <Button type="submit" loading={busy} className="w-full">
          Schedule visit
        </Button>
      </form>
    </Sheet>
  );
}