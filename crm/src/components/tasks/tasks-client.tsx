"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, CalendarClock, Clock, ListChecks, PhoneCall, MessageCircle, CalendarDays, Users, Plus } from "lucide-react";
import { toast } from "sonner";
import { completeFollowup, completeTask, scheduleFollowup } from "@/lib/actions/crm";
import type { TaskFeedItem, TaskView, EntityCandidate } from "@/lib/data/tasks";
import { Badge, followupStatusTone, taskStatusTone, humanize } from "@/components/ui/badge";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateTime } from "@/lib/utils";

const KIND_ICON: Record<string, typeof PhoneCall> = {
  call: PhoneCall,
  whatsapp: MessageCircle,
  meeting: CalendarDays,
  visit: Users,
  email: MessageCircle,
  task: ListChecks,
  custom: Clock,
};

export function TasksClient({
  view,
  items,
  counts,
  candidates,
}: {
  view: TaskView;
  items: TaskFeedItem[];
  counts: Record<TaskView, number>;
  candidates: EntityCandidate[];
}) {
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);

  const tabs = useMemo(
    () =>
      (
        [
          { value: "today", label: "Today" },
          { value: "upcoming", label: "Upcoming" },
          { value: "overdue", label: "Overdue" },
          { value: "completed", label: "Completed" },
        ] as { value: TaskView; label: string }[]
      ).map((t) => ({
        ...t,
        active: t.value === view,
        count: counts[t.value],
      })),
    [view, counts]
  );

  return (
    <div className="space-y-4">
      <div className="sticky top-[57px] z-10 -mx-4 bg-[#f7f7f8] px-4 pb-2 pt-1">
        <div className="flex gap-1 overflow-x-auto rounded-lg bg-zinc-100 p-1">
          {tabs.map((t) => (
            <Link
              key={t.value}
              href={`/tasks?view=${t.value}`}
              className={`flex flex-1 shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                t.active ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${
                  t.active ? "bg-[var(--primary)]/10 text-[var(--primary)]" : "bg-zinc-200 text-zinc-600"
                }`}
              >
                {t.count}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="No tasks here"
          description="Nothing scheduled in this view. Schedule a follow-up to stay on top of your pipeline."
          action={
            <button
              onClick={() => setSheetOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 py-2 text-xs font-medium text-white"
            >
              <Plus className="h-4 w-4" /> New follow-up
            </button>
          }
        />
      ) : (
        <ul className="space-y-2">
          {items.map((item) => {
            const KindIcon = KIND_ICON[item.kind] ?? Clock;
            return (
              <li
                key={`${item.source}-${item.id}`}
                className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-white p-3.5 shadow-sm"
              >
                <span className="mt-0.5 rounded-lg bg-zinc-50 p-2">
                  <KindIcon className="h-4 w-4 text-muted-foreground" />
                </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="text-sm font-medium">{item.subject}</p>
                  {item.source === "followup" ? (
                    <Badge tone={followupStatusTone(item.status)}>{humanize(item.status)}</Badge>
                  ) : (
                    <Badge tone={taskStatusTone(item.status)}>{humanize(item.status)}</Badge>
                  )}
                </div>
                {item.entity_id ? (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    <Link
                      href={`/${item.entity_type === "customer" ? "customers" : item.entity_type === "opportunity" ? "pipeline" : "leads"}/${item.entity_id}`}
                      className="font-medium text-[var(--primary)] hover:underline"
                    >
                      {item.entity_name ?? "Linked record"}
                    </Link>
                    {item.entity_mobile ? ` · ${item.entity_mobile}` : ""}
                  </p>
                ) : (
                  <p className="mt-0.5 text-xs text-muted-foreground">Personal task</p>
                )}
                <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                  <CalendarClock className="h-3 w-3" />
                  {formatDateTime(item.due_at)}
                </p>
                {item.note ? <p className="mt-1 text-xs text-muted-foreground">{item.note}</p> : null}
              </div>
              {item.status === "PENDING" || item.status === "TODO" || item.status === "IN_PROGRESS" ? (
                <button
                  onClick={async () => {
                    const res =
                      item.source === "followup"
                        ? await completeFollowup(item.id)
                        : await completeTask(item.id);
                    if (res?.success) {
                      toast.success("Marked as done");
                      router.refresh();
                    } else {
                      toast.error(res?.error ?? "Could not complete");
                    }
                  }}
                  aria-label="Mark as done"
                  className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--input)] text-muted-foreground hover:border-[var(--success)] hover:text-[var(--success)]"
                >
                  <Check className="h-4 w-4" />
                </button>
              ) : null}
            </li>
          );
          })}
        </ul>
      )}

      <div className="flex justify-center">
        <Button variant="outline" size="sm" onClick={() => setSheetOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> New follow-up
        </Button>
      </div>

      <FollowupSheet
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

function FollowupSheet({
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
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Schedule a follow-up"
      description="Pick the lead or customer and when to follow up."
    >
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
          const res = await scheduleFollowup(null, fd);
          setBusy(false);
          if (res?.success) {
            toast.success("Follow-up scheduled");
            onSaved();
          } else {
            toast.error(res?.error ?? "Could not schedule");
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
            <Select name="kind" defaultValue="call">
              <option value="call">Call</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="meeting">Meeting</option>
              <option value="visit">Visit</option>
              <option value="email">Email</option>
              <option value="task">Task</option>
              <option value="custom">Custom</option>
            </Select>
          </Field>
          <Field label="Due date & time" required>
            <Input name="due_at" type="datetime-local" required />
          </Field>
        </div>
        <Field label="Subject" required>
          <Input name="subject" placeholder="Discuss price for 20mm PPR pipes" required maxLength={300} />
        </Field>
        <Field label="Note">
          <Textarea name="note" placeholder="Any context for this follow-up" />
        </Field>
        <Button type="submit" loading={busy} className="w-full">
          Schedule follow-up
        </Button>
      </form>
    </Sheet>
  );
}