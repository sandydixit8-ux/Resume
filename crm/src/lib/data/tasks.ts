import "server-only";
import { createClient } from "@/lib/supabase/server";
import { listFollowups } from "@/lib/data/dashboard";

export type TaskView = "today" | "upcoming" | "overdue" | "completed";

export const TASK_VIEWS: { value: TaskView; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "upcoming", label: "Upcoming" },
  { value: "overdue", label: "Overdue" },
  { value: "completed", label: "Completed" },
];

export function isTaskView(v: string | undefined): v is TaskView {
  return v === "today" || v === "upcoming" || v === "overdue" || v === "completed";
}

export interface TaskFeedItem {
  id: string;
  source: "followup" | "task";
  kind: string;
  subject: string;
  due_at: string;
  status: string;
  priority?: string;
  entity_type: string | null;
  entity_id: string | null;
  entity_name?: string;
  entity_mobile?: string | null;
  note: string | null;
}

interface EntityRef {
  name: string;
  mobile: string | null;
}

async function enrichEntityNames(supabase: Awaited<ReturnType<typeof createClient>>, items: { entity_type: string | null; entity_id: string | null }[]) {
  const names: Record<string, EntityRef> = {};
  const leadIds = items.filter((i) => i.entity_type === "lead" && i.entity_id).map((i) => i.entity_id as string);
  const customerIds = items.filter((i) => i.entity_type === "customer" && i.entity_id).map((i) => i.entity_id as string);
  const oppIds = items.filter((i) => i.entity_type === "opportunity" && i.entity_id).map((i) => i.entity_id as string);

  if (leadIds.length) {
    const { data } = await supabase.from("leads").select("id, name, mobile").in("id", leadIds);
    (data ?? []).forEach((l) => (names[l.id] = { name: l.name, mobile: l.mobile }));
  }
  if (customerIds.length) {
    const { data } = await supabase.from("customers").select("id, name, mobile").in("id", customerIds);
    (data ?? []).forEach((c) => (names[c.id] = { name: c.name, mobile: c.mobile }));
  }
  if (oppIds.length) {
    const { data } = await supabase.from("opportunities").select("id, name").in("id", oppIds);
    (data ?? []).forEach((o) => (names[o.id] = { name: o.name, mobile: null }));
  }
  return names;
}

/** Combined feed of follow-ups and standalone tasks for the given view. */
export async function listTasksFeed(view: TaskView): Promise<TaskFeedItem[]> {
  const supabase = await createClient();
  const followups = await listFollowups(view);

  const now = new Date();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  let taskQuery = supabase.from("tasks").select("*").order("due_at", { ascending: true, nullsFirst: true }).limit(100);
  if (view === "completed") {
    taskQuery = taskQuery.in("status", ["DONE", "CANCELLED"]);
  } else {
    taskQuery = taskQuery.in("status", ["TODO", "IN_PROGRESS"]);
    if (view === "today") taskQuery = taskQuery.gte("due_at", startOfDay.toISOString()).lt("due_at", endOfDay.toISOString());
    if (view === "upcoming") taskQuery = taskQuery.gte("due_at", endOfDay.toISOString());
    if (view === "overdue") taskQuery = taskQuery.lt("due_at", startOfDay.toISOString());
  }

  const { data: taskRows } = await taskQuery;
  const tasks: TaskFeedItem[] = (taskRows ?? []).map((t) => ({
    id: t.id,
    source: "task",
    kind: "task",
    subject: t.subject,
    due_at: t.due_at ?? t.created_at,
    status: t.status,
    priority: t.priority,
    entity_type: t.entity_type,
    entity_id: t.entity_id,
    note: t.description,
  }));

  const followupItems: TaskFeedItem[] = followups.map((f) => ({
    id: f.id,
    source: "followup",
    kind: f.kind,
    subject: f.subject,
    due_at: f.due_at,
    status: f.status,
    entity_type: f.entity_type,
    entity_id: f.entity_id,
    entity_name: f.entity_name,
    entity_mobile: f.entity_mobile,
    note: f.note,
  }));

  const names = await enrichEntityNames(supabase, [...followupItems, ...tasks]);
  for (const t of tasks) {
    if (t.entity_id && names[t.entity_id]) {
      t.entity_name = names[t.entity_id].name;
      t.entity_mobile = names[t.entity_id].mobile;
    }
  }

  const all = [...followupItems, ...tasks];
  return all.sort((a, b) => {
    const aOverdue = new Date(a.due_at).getTime() < now.getTime() && a.status !== "DONE";
    const bOverdue = new Date(b.due_at).getTime() < now.getTime() && b.status !== "DONE";
    if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
    return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
  });
}

export interface EntityCandidate {
  id: string;
  type: "lead" | "customer";
  name: string;
  mobile: string | null;
  subtitle: string;
}

/** Counts per view, computed from a single lightweight fetch of follow-ups + tasks. */
export async function getTaskCounts(): Promise<Record<TaskView, number>> {
  const supabase = await createClient();
  const [followupsRes, tasksRes] = await Promise.all([
    supabase.from("followups").select("status, due_at"),
    supabase.from("tasks").select("status, due_at"),
  ]);

  const now = new Date();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  let today = 0;
  let upcoming = 0;
  let overdue = 0;
  let completed = 0;

  const bucket = (status: string | null, due: string | null) => {
    if (!due) return;
    const t = new Date(due).getTime();
    if (status === "DONE" || status === "CANCELLED") {
      completed += 1;
      return;
    }
    if (t < startOfDay.getTime()) overdue += 1;
    else if (t >= startOfDay.getTime() && t < endOfDay.getTime()) today += 1;
    else upcoming += 1;
  };

  (followupsRes.data ?? []).forEach((f) => bucket(f.status, f.due_at));
  (tasksRes.data ?? []).forEach((t) => bucket(t.status, t.due_at));

  return { today, upcoming, overdue, completed };
}

/** Leads + customers used to pick the subject of a new follow-up. */
export async function getEntityCandidates(): Promise<EntityCandidate[]> {
  const supabase = await createClient();
  const [leadsRes, customersRes] = await Promise.all([
    supabase.from("leads").select("id, name, mobile, lead_no").eq("is_deleted", false).order("created_at", { ascending: false }).limit(100),
    supabase.from("customers").select("id, name, mobile, customer_no").eq("is_deleted", false).order("created_at", { ascending: false }).limit(100),
  ]);

  const leads: EntityCandidate[] = (leadsRes.data ?? []).map((l) => ({
    id: l.id,
    type: "lead",
    name: l.name,
    mobile: l.mobile,
    subtitle: `Lead ${l.lead_no}`,
  }));
  const customers: EntityCandidate[] = (customersRes.data ?? []).map((c) => ({
    id: c.id,
    type: "customer",
    name: c.name,
    mobile: c.mobile,
    subtitle: `Customer ${c.customer_no}`,
  }));

  return [...leads, ...customers];
}