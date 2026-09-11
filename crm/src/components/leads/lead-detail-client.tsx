"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Phone,
  MessageCircle,
  Mail,
  CalendarClock,
  UserCheck,
  UserPlus,
  FileText,
  Building2,
  MapPin,
  Tag,
  PhoneCall,
  CheckCircle2,
} from "lucide-react";
import type { Lead, Activity, Followup, Quotation, Message } from "@/types/supabase";
import { Badge, priorityTone, leadStatusTone, humanize, followupStatusTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sheet } from "@/components/ui/sheet";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { formatMoney, formatDateTime, toLocalDateTimeInput, daysUntil } from "@/lib/utils";
import {
  logActivity,
  scheduleFollowup,
  convertLeadToCustomer,
  assignLead,
  sendMessageAction,
  completeFollowup,
} from "@/lib/actions/crm";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

const ACTIVITY_ICON: Record<string, typeof PhoneCall> = {
  call: PhoneCall,
  whatsapp: MessageCircle,
  email: Mail,
  meeting: CalendarClock,
  visit: MapPin,
  note: FileText,
  task: CheckCircle2,
  system: Building2,
};

export function LeadDetailClient({
  lead,
  ownerName,
  createdByName,
  activities,
  followups,
  quotations,
  messages,
  assignableUsers,
}: {
  lead: Lead;
  ownerName: string | null;
  createdByName: string | null;
  activities: Activity[];
  followups: Followup[];
  quotations: Quotation[];
  messages: Message[];
  assignableUsers: { id: string; full_name: string }[];
}) {
  const router = useRouter();
  const [callOpen, setCallOpen] = useState(false);
  const [waOpen, setWaOpen] = useState(false);
  const [fupOpen, setFupOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [active, setActive] = useState("overview");
  const [converting, setConverting] = useState(false);
  const [busy, setBusy] = useState(false);

  const nextFollowup = followups.find((f) => f.status === "PENDING");
  const overdue = nextFollowup && daysUntil(nextFollowup.due_at) !== null && daysUntil(nextFollowup.due_at)! < 0;

  async function handleLogCall(fd: FormData) {
    fd.set("entity_type", "lead");
    fd.set("entity_id", lead.id);
    fd.set("activity_type", "call");
    fd.set("direction", "out");
    const res = await logActivity(null, fd);
    if (res?.success) {
      setCallOpen(false);
      toast.success("Call logged");
      router.refresh();
    } else if (res) {
      toast.error(res.error);
    }
  }

  async function handleWhatsApp(fd: FormData) {
    setBusy(true);
    const body = String(fd.get("body") ?? "");
    const res = await sendMessageAction("lead", lead.id, "whatsapp", body);
    setBusy(false);
    if (res?.success) {
      setWaOpen(false);
      toast.success("WhatsApp message sent (mock provider)");
      router.refresh();
    } else if (res) {
      toast.error(res.error);
    }
  }

  async function handleFollowup(fd: FormData) {
    const res = await scheduleFollowup(null, fd);
    if (res?.success) {
      setFupOpen(false);
      toast.success("Follow-up scheduled");
      router.refresh();
    } else if (res) {
      toast.error(res.error);
    }
  }

  async function handleConvert() {
    setConverting(true);
    const res = await convertLeadToCustomer(lead.id);
    setConverting(false);
    if (res?.success) {
      toast.success("Lead converted to customer");
      router.refresh();
    } else if (res) {
      toast.error(res.error);
    }
  }

  async function handleAssign(fd: FormData) {
    const ownerId = String(fd.get("owner_id") ?? "");
    const res = await assignLead(lead.id, ownerId);
    if (res?.success) {
      setAssignOpen(false);
      toast.success("Lead reassigned");
      router.refresh();
    } else if (res) {
      toast.error(res.error);
    }
  }

  return (
    <>
      {/* Header */}
      <div className="rounded-xl border border-[var(--border)] bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-50 text-base font-bold text-[var(--primary)]">
              {lead.name.slice(0, 2).toUpperCase()}
            </span>
            <div>
              <h2 className="text-base font-semibold leading-tight">{lead.name}</h2>
              <p className="text-xs text-muted-foreground">
                {lead.company ?? lead.lead_no}
                {lead.city ? ` · ${lead.city}` : ""}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <Badge tone={leadStatusTone(lead.status)}>{humanize(lead.status)}</Badge>
                <Badge tone={priorityTone(lead.priority)}>{lead.priority}</Badge>
                <Badge>{lead.source}</Badge>
              </div>
            </div>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <p>Owner: {ownerName ?? <span className="text-[var(--warning)]">Unassigned</span>}</p>
            <p className="mt-0.5">Added by {createdByName ?? "—"}</p>
          </div>
        </div>

        {/* Quick actions */}
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
          <Button variant="outline" size="sm" onClick={() => setCallOpen(true)}>
            <Phone className="h-3.5 w-3.5" /> Call
          </Button>
          <Button variant="outline" size="sm" onClick={() => setWaOpen(true)}>
            <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
          </Button>
          <Button variant="outline" size="sm" onClick={() => setFupOpen(true)}>
            <CalendarClock className="h-3.5 w-3.5" /> Follow-up
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/quotations?lead=${lead.id}`)}
            title="Create a quotation for this lead"
          >
            <FileText className="h-3.5 w-3.5" /> Quote
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleConvert}
            loading={converting}
            disabled={Boolean(lead.converted_customer_id)}
            title={lead.converted_customer_id ? "Already converted" : "Convert this lead into a customer"}
          >
            <UserCheck className="h-3.5 w-3.5" /> Convert
          </Button>
        </div>

        {nextFollowup ? (
          <div
            className={cn(
              "mt-3 flex items-center justify-between rounded-lg border px-3 py-2",
              overdue ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"
            )}
          >
            <div className="flex items-center gap-2">
              <CalendarClock className={cn("h-4 w-4", overdue ? "text-[var(--destructive)]" : "text-[var(--warning)]")} />
              <span className="text-xs font-medium">
                Next {humanize(nextFollowup.kind)}: {nextFollowup.subject}
              </span>
            </div>
            <span className={cn("text-[11px] font-semibold", overdue ? "text-[var(--destructive)]" : "text-[var(--warning)]")}>
              {overdue ? "Overdue" : formatDateTime(nextFollowup.due_at)}
            </span>
          </div>
        ) : null}
      </div>

      {/* Tabs */}
      <Tabs value={active} onValueChange={setActive} className="mt-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="activities">Activities</TabsTrigger>
          <TabsTrigger value="communication">Communication</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab lead={lead} followups={followups} quotations={quotations} onAssign={() => setAssignOpen(true)} />
        </TabsContent>
        <TabsContent value="timeline">
          <TimelineTab activities={activities} followups={followups} onComplete={completeFollowup} />
        </TabsContent>
        <TabsContent value="activities">
          <ActivityList activities={activities} />
        </TabsContent>
        <TabsContent value="communication">
          <CommunicationTab messages={messages} lead={lead} />
        </TabsContent>
      </Tabs>

      {/* Log call */}
      <Sheet open={callOpen} onOpenChange={setCallOpen} title="Log call" description="Quick record — around 10 seconds">
        <form action={handleLogCall} className="space-y-3">
          <Field label="What happened on the call?" required>
            <Input name="summary" placeholder="Discussed pricing and delivery timeline" required />
          </Field>
          <Button type="submit" className="w-full">
            Save call
          </Button>
        </form>
      </Sheet>

      {/* WhatsApp */}
      <Sheet open={waOpen} onOpenChange={setWaOpen} title="Send WhatsApp" description="Development mock provider — swap to a live WhatsApp Business API in Settings">
        <form action={handleWhatsApp} className="space-y-3">
          <Field label="Message" required>
            <Textarea
              name="body"
              defaultValue={`Hi ${lead.name.split(" ")[0]},`}
              required
            />
          </Field>
          <p className="text-[11px] text-muted-foreground">
            Sending to {lead.whatsapp_number ?? lead.mobile ?? "—"}. Marketing sends require customer opt-in.
          </p>
          <Button type="submit" className="w-full" loading={busy}>
            Send
          </Button>
        </form>
      </Sheet>

      {/* Follow-up */}
      <Sheet open={fupOpen} onOpenChange={setFupOpen} title="Schedule follow-up" description="Set a reminder for yourself or the owner">
        <form action={handleFollowup} className="space-y-3">
          <input type="hidden" name="entity_type" value="lead" />
          <input type="hidden" name="entity_id" value={lead.id} />
          <Field label="Type" required>
            <Select name="kind" defaultValue="call">
              {["call", "whatsapp", "meeting", "visit", "email", "task", "custom"].map((k) => (
                <option key={k} value={k}>
                  {humanize(k)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Subject" required>
            <Input name="subject" defaultValue={`Follow up with ${lead.name}`} required />
          </Field>
          <Field label="Date & time" required>
            <Input name="due_at" type="datetime-local" defaultValue={toLocalDateTimeInput(new Date(Date.now() + 86400000))} required />
          </Field>
          <Field label="Repeat">
            <Select name="recurring_interval" defaultValue="">
              <option value="">Never</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </Select>
          </Field>
          <Button type="submit" className="w-full">
            Schedule
          </Button>
        </form>
      </Sheet>

      {/* Assign */}
      <Sheet open={assignOpen} onOpenChange={setAssignOpen} title="Reassign lead">
        <form action={handleAssign} className="space-y-3">
          <Field label="Salesperson" required>
            <Select name="owner_id" defaultValue={lead.owner_id ?? ""}>
              <option value="">—</option>
              {assignableUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name}
                </option>
              ))}
            </Select>
          </Field>
          <Button type="submit" className="w-full">
            Assign
          </Button>
        </form>
      </Sheet>
    </>
  );
}

function OverviewTab({
  lead,
  followups,
  quotations,
  onAssign,
}: {
  lead: Lead;
  followups: Followup[];
  quotations: Quotation[];
  onAssign: () => void;
}) {
  const rows: Array<[string, React.ReactNode]> = [
    ["Mobile", lead.mobile ?? "—"],
    ["Email", lead.email ?? "—"],
    ["Company", lead.company ?? "—"],
    ["Value", formatMoney(lead.value)],
    ["Score", `${lead.score}/100 (algorithmic recommendation)`],
    ["Product interest", lead.product_interest ?? "—"],
    ["Address", [lead.address, lead.city, lead.state, lead.pincode].filter(Boolean).join(", ") || "—"],
  ];
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[var(--border)] bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold">Lead details</h3>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          {rows.map(([k, v]) => (
            <div key={k}>
              <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{k}</dt>
              <dd className="mt-0.5 text-sm">{v}</dd>
            </div>
          ))}
        </dl>
        {lead.tags?.length ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {lead.tags.map((t) => (
              <Badge key={t} tone="neutral">
                <Tag className="h-3 w-3" />
                {t}
              </Badge>
            ))}
          </div>
        ) : null}
        {lead.notes ? (
          <div className="mt-3 rounded-lg bg-zinc-50 p-3 text-sm">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Notes</p>
            {lead.notes}
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-[var(--border)] bg-white p-4 shadow-sm">
          <h3 className="mb-2 flex items-center justify-between text-sm font-semibold">
            Follow-ups
            <button onClick={onAssign} className="inline-flex items-center gap-1 text-xs font-medium text-[var(--primary)]">
              <UserPlus className="h-3.5 w-3.5" /> Reassign
            </button>
          </h3>
          {followups.length === 0 ? (
            <p className="text-xs text-muted-foreground">No follow-ups yet. Schedule one with the Follow-up button.</p>
          ) : (
            <ul className="space-y-2">
              {followups.slice(0, 5).map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-2 rounded-lg bg-zinc-50 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium">{f.subject}</p>
                    <p className="text-[11px] text-muted-foreground">{formatDateTime(f.due_at)}</p>
                  </div>
                  <Badge tone={followupStatusTone(f.status)}>{humanize(f.status)}</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-white p-4 shadow-sm">
          <h3 className="mb-2 text-sm font-semibold">Quotations</h3>
          {quotations.length === 0 ? (
            <p className="text-xs text-muted-foreground">No quotations yet.</p>
          ) : (
            <ul className="space-y-2">
              {quotations.slice(0, 5).map((q) => (
                <li key={q.id} className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2">
                  <span className="text-xs font-medium">{q.quote_no}</span>
                  <span className="text-xs tabular-nums">{formatMoney(q.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function TimelineTab({
  activities,
  followups,
  onComplete,
}: {
  activities: Activity[];
  followups: Followup[];
  onComplete: (id: string) => Promise<{ success: boolean; error?: string }>;
}) {
  const items: Array<{ at: string; kind: "activity" | "followup"; data: Activity | Followup }> = [
    ...activities.map((a) => ({ at: a.performed_at, kind: "activity" as const, data: a })),
    ...followups.map((f) => ({ at: f.created_at, kind: "followup" as const, data: f })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-white p-6 text-center text-sm text-muted-foreground">
        Nothing here yet. Log a call or WhatsApp to start the timeline.
      </div>
    );
  }

  return (
    <ol className="relative ml-3 space-y-5 border-l border-[var(--border)] pl-5">
      {items.slice(0, 60).map((item, i) => {
        if (item.kind === "followup") {
          const f = item.data as Followup;
          return (
            <li key={`f-${f.id}`} className="relative">
              <span className="absolute -left-[27px] mt-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-amber-100">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              </span>
              <p className="text-xs">
                <span className="font-medium">Follow-up scheduled ({humanize(f.kind)})</span> · {formatDateTime(f.due_at)}
              </p>
              <p className="text-[11px] text-muted-foreground">{f.subject}</p>
              <div className="mt-1 flex items-center gap-2">
                <Badge tone={followupStatusTone(f.status)}>
                  {humanize(f.status)}
                </Badge>
                {f.status === "PENDING" ? (
                  <button
                    onClick={async () => {
                      const res = await onComplete(f.id);
                      if (res?.success) toast.success("Marked as done");
                      else toast.error(res?.error ?? "Could not complete");
                    }}
                    className="text-[11px] font-medium text-[var(--primary)] hover:underline"
                  >
                    Mark done
                  </button>
                ) : null}
              </div>
            </li>
          );
        }
        const a = item.data as Activity;
        const Icon = ACTIVITY_ICON[a.activity_type] ?? PhoneCall;
        return (
          <li key={`a-${a.id}`} className="relative">
            <span className="absolute -left-[27px] mt-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-zinc-100">
              <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
            </span>
            <div className="flex items-center gap-1.5 text-xs">
              <Icon className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-medium capitalize">{a.activity_type}</span>
              <span className="text-muted-foreground">· {formatDateTime(a.performed_at)}</span>
            </div>
            <p className="mt-0.5 text-sm">{a.summary}</p>
          </li>
        );
      })}
    </ol>
  );
}

function ActivityList({ activities }: { activities: Activity[] }) {
  if (activities.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-white p-6 text-center text-sm text-muted-foreground">
        No activities logged yet.
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-sm">
      <ul className="divide-y divide-[var(--border)]">
        {activities.slice(0, 30).map((a) => {
          const Icon = ACTIVITY_ICON[a.activity_type] ?? PhoneCall;
          return (
            <li key={a.id} className="flex items-start gap-3 px-4 py-3">
              <span className="mt-0.5 rounded-lg bg-zinc-50 p-1.5">
                <Icon className="h-4 w-4 text-muted-foreground" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm">{a.summary}</p>
                <p className="text-[11px] text-muted-foreground">
                  {humanize(a.activity_type)}
                  {a.direction ? ` · ${a.direction}` : ""} · {formatDateTime(a.performed_at)}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function CommunicationTab({ messages, lead }: { messages: Message[]; lead: Lead }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-white shadow-sm">
      {messages.length === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground">
          No messages yet. Use the WhatsApp button to send the first message.
        </div>
      ) : (
        <ul className="divide-y divide-[var(--border)]">
          {messages.map((m) => (
            <li key={m.id} className="flex items-start gap-3 px-4 py-3">
              <span className={cn("mt-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold", m.direction === "out" ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700")}>
                {m.direction === "out" ? "OUT" : "IN"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm">{m.body}</p>
                <p className="text-[11px] text-muted-foreground">
                  {m.channel.toUpperCase()} · {m.provider} · {m.status}
                  {m.recipient ? ` · to ${m.recipient}` : ""} · {formatDateTime(m.created_at)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="border-t border-[var(--border)] px-4 py-2 text-[11px] text-muted-foreground">
        WhatsApp uses the development mock provider. Connect the WhatsApp Business API in Settings to go live.
      </p>
    </div>
  );
}