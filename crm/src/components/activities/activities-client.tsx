"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PhoneCall, MessageCircle, Mail, CalendarDays, Footprints, StickyNote, ClipboardList, ShoppingCart, FileText, Truck, Banknote, Plus } from "lucide-react";
import { toast } from "sonner";
import { logActivity } from "@/lib/actions/crm";
import type { ActivityFeedRow } from "@/lib/data/activities";
import type { EntityCandidate } from "@/lib/data/tasks";
import { Badge } from "@/components/ui/badge";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Field, Select, Textarea } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateTime, formatDate } from "@/lib/utils";

const ACTIVITY_ICON: Record<string, typeof PhoneCall> = {
  call: PhoneCall,
  whatsapp: MessageCircle,
  email: Mail,
  meeting: CalendarDays,
  visit: Footprints,
  note: StickyNote,
  task: ClipboardList,
  system: ClipboardList,
  quote: FileText,
  order: ShoppingCart,
  payment: Banknote,
  delivery: Truck,
};

function entityHref(entity_type: string, entity_id: string | null): string {
  if (!entity_id) return "/activities";
  switch (entity_type) {
    case "lead":
      return `/leads/${entity_id}`;
    case "customer":
      return `/customers/${entity_id}`;
    case "opportunity":
      return `/pipeline?opp=${entity_id}`;
    case "order":
      return `/orders/${entity_id}`;
    case "quotation":
      return `/quotations/${entity_id}`;
    case "invoice":
      return `/invoices/${entity_id}`;
    default:
      return "/activities";
  }
}

export function ActivitiesClient({
  activities,
  candidates,
}: {
  activities: ActivityFeedRow[];
  candidates: EntityCandidate[];
}) {
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);

  const groups = useMemo(() => {
    const map = new Map<string, ActivityFeedRow[]>();
    for (const a of activities) {
      const key = formatDate(a.performed_at);
      const arr = map.get(key) ?? [];
      arr.push(a);
      map.set(key, arr);
    }
    return [...map.entries()];
  }, [activities]);

  return (
    <div className="space-y-4">
      {activities.length === 0 ? (
        <EmptyState
          icon={PhoneCall}
          title="No activities yet"
          description="Calls, WhatsApp messages and meetings you log will appear here."
          action={
            <button
              onClick={() => setSheetOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 py-2 text-xs font-medium text-white"
            >
              <Plus className="h-4 w-4" /> Log activity
            </button>
          }
        />
      ) : (
        groups.map(([day, items]) => (
          <section key={day}>
            <h2 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{day}</h2>
            <ul className="space-y-2">
              {items.map((a) => {
                const Icon = ACTIVITY_ICON[a.activity_type] ?? StickyNote;
                return (
                  <li key={a.id} className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-white p-3.5 shadow-sm">
                    <span className="mt-0.5 rounded-lg bg-zinc-50 p-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <p className="text-sm">{a.summary}</p>
                        {a.direction ? <Badge>{a.direction === "in" ? "Incoming" : "Outgoing"}</Badge> : null}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        <span className="capitalize">{a.activity_type.replaceAll("_", " ")}</span>
                        {a.entity_id ? (
                          <>
                            {" · "}
                            <Link href={entityHref(a.entity_type, a.entity_id)} className="font-medium text-[var(--primary)] hover:underline">
                              {a.entity_name ?? a.entity_type}
                            </Link>
                            {a.entity_mobile ? ` · ${a.entity_mobile}` : ""}
                          </>
                        ) : null}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{formatDateTime(a.performed_at)}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}

      <div className="flex justify-center">
        <Button variant="outline" size="sm" onClick={() => setSheetOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> Log activity
        </Button>
      </div>

      <LogActivitySheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        candidates={candidates}
        onSaved={() => {
          setSheetOpen(false);
          router.refresh();
        }}
      />
    </div>
  );
}

function LogActivitySheet({
  open,
  onOpenChange,
  candidates,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidates: EntityCandidate[];
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false);

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Log activity" description="Record a call, message or meeting against a lead or customer.">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const entityId = String(fd.get("entity_id") ?? "");
          const selected = candidates.find((c) => c.id === entityId);
          if (!selected) {
            toast.error("Select a lead or customer");
            return;
          }
          fd.set("entity_type", selected.type);
          setBusy(true);
          const res = await logActivity(null, fd);
          setBusy(false);
          if (res?.success) {
            toast.success("Activity logged");
            onSaved();
          } else {
            toast.error(res?.error ?? "Could not log");
          }
        }}
      >
        <Field label="Lead / Customer" required>
          <Select name="entity_id" required defaultValue="">
            <option value="" disabled>
              Select a lead or customer
            </option>
            {candidates.map((c) => (
              <option key={`${c.type}-${c.id}`} value={c.id}>
                {c.name} ({c.type} · {c.mobile ?? c.subtitle})
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Type" required>
            <Select name="activity_type" defaultValue="call">
              <option value="call">Call</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="email">Email</option>
              <option value="meeting">Meeting</option>
              <option value="note">Note</option>
            </Select>
          </Field>
          <Field label="Direction">
            <Select name="direction" defaultValue="out">
              <option value="out">Outgoing</option>
              <option value="in">Incoming</option>
            </Select>
          </Field>
        </div>
        <Field label="Summary" required>
          <Textarea name="summary" placeholder="What happened on this call / message?" required maxLength={1000} />
        </Field>
        <Button type="submit" loading={busy} className="w-full">
          Save activity
        </Button>
      </form>
    </Sheet>
  );
}