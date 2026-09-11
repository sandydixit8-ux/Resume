import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface DashboardStats {
  totalLeads: number;
  newLeads: number;
  hotLeads: number;
  followupsToday: number;
  followupsOverdue: number;
  openOpportunities: number;
  pipelineValue: number;
  weightedPipeline: number;
  wonDeals: number;
  lostDeals: number;
  ordersToday: number;
  pendingOrders: number;
  revenue: number;
  outstanding: number;
  lowStock: number;
  deliveriesInProgress: number;
  todayCalls: number;
  todayVisits: number;
  totalCustomers: number;
  products: number;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const supabase = await createClient();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  const [
    leadsRes,
    fupsTodayRes,
    fupsOverdueRes,
    oppsRes,
    ordersTodayRes,
    pendingOrdersRes,
    invoicesRes,
    deliveriesRes,
    callsRes,
    visitsRes,
    customersRes,
    productsRes,
    wonRes,
    lostRes,
  ] = await Promise.all([
    supabase.from("leads").select("status, priority").eq("is_deleted", false),
    supabase
      .from("followups")
      .select("id", { count: "exact", head: true })
      .eq("status", "PENDING")
      .gte("due_at", startOfDay.toISOString())
      .lt("due_at", endOfDay.toISOString()),
    supabase
      .from("followups")
      .select("id", { count: "exact", head: true })
      .eq("status", "PENDING")
      .lt("due_at", startOfDay.toISOString()),
    supabase.from("opportunities").select("value, probability").eq("status", "OPEN"),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .gte("created_at", startOfDay.toISOString())
      .lt("created_at", endOfDay.toISOString()),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .in("status", ["CONFIRMED", "PROCESSING", "PACKED"]),
    supabase.from("invoices").select("total, paid_amount, status"),
    supabase
      .from("deliveries")
      .select("id", { count: "exact", head: true })
      .in("status", ["ASSIGNED", "PICKED", "DISPATCHED", "IN_TRANSIT", "OUT_FOR_DELIVERY"]),
    supabase
      .from("activities")
      .select("id", { count: "exact", head: true })
      .eq("activity_type", "call")
      .gte("performed_at", startOfDay.toISOString())
      .lt("performed_at", endOfDay.toISOString()),
    supabase
      .from("visits")
      .select("id", { count: "exact", head: true })
      .eq("status", "STARTED"),
    supabase.from("customers").select("id", { count: "exact", head: true }).eq("is_deleted", false),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("opportunities").select("id", { count: "exact", head: true }).eq("status", "WON"),
    supabase.from("opportunities").select("id", { count: "exact", head: true }).eq("status", "LOST"),
  ]);

  const leadRows = (leadsRes.data ?? []) as { status: string; priority: string }[];
  const openOpps = (oppsRes.data ?? []) as { value: number; probability: number }[];
  const pipelineValue = openOpps.reduce((s, o) => s + Number(o.value || 0), 0);
  const weightedPipeline = openOpps.reduce(
    (s, o) => s + Number(o.value || 0) * (Number(o.probability || 0) / 100),
    0
  );

  const invoices = (invoicesRes.data ?? []) as { total: number; paid_amount: number; status: string }[];
  const revenue = invoices.filter((i) => i.status === "PAID").reduce((s, i) => s + Number(i.total || 0), 0);
  const outstanding = invoices
    .filter((i) => ["ISSUED", "PARTIALLY_PAID", "OVERDUE"].includes(i.status))
    .reduce((s, i) => s + (Number(i.total || 0) - Number(i.paid_amount || 0)), 0);

  let lowStock = 0;
  {
    const [invRows, productRows] = await Promise.all([
      supabase.from("inventory").select("product_id, quantity"),
      supabase.from("products").select("id, min_stock"),
    ]);
    const minStock = new Map((productRows.data ?? []).map((p) => [p.id, Number(p.min_stock) || 0]));
    const stock = new Map<string, number>();
    (invRows.data ?? []).forEach((r) => {
      stock.set(r.product_id, (stock.get(r.product_id) ?? 0) + Number(r.quantity));
    });
    stock.forEach((qty, pid) => {
      if (qty < (minStock.get(pid) ?? 0)) lowStock += 1;
    });
  }

  return {
    totalLeads: leadRows.length,
    newLeads: leadRows.filter((r) => r.status === "NEW").length,
    hotLeads: leadRows.filter((r) => r.priority === "HOT" && r.status !== "WON" && r.status !== "LOST").length,
    followupsToday: fupsTodayRes.count ?? 0,
    followupsOverdue: fupsOverdueRes.count ?? 0,
    openOpportunities: oppsRes.count ?? openOpps.length,
    pipelineValue,
    weightedPipeline,
    wonDeals: wonRes.count ?? 0,
    lostDeals: lostRes.count ?? 0,
    ordersToday: ordersTodayRes.count ?? 0,
    pendingOrders: pendingOrdersRes.count ?? 0,
    revenue,
    outstanding,
    lowStock,
    deliveriesInProgress: deliveriesRes.count ?? 0,
    todayCalls: callsRes.count ?? 0,
    todayVisits: visitsRes.count ?? 0,
    totalCustomers: customersRes.count ?? 0,
    products: productsRes.count ?? 0,
  };
}

export interface FollowupRow {
  id: string;
  entity_type: string;
  entity_id: string;
  kind: string;
  subject: string;
  due_at: string;
  status: string;
  context: string | null;
  note: string | null;
  created_at: string;
  entity_name?: string;
  entity_mobile?: string | null;
}

export async function listFollowups(view: "today" | "upcoming" | "overdue" | "completed"): Promise<FollowupRow[]> {
  const supabase = await createClient();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  let query = supabase
    .from("followups")
    .select("*")
    .order("due_at", { ascending: view === "overdue" });

  if (view === "today") {
    query = query.eq("status", "PENDING").gte("due_at", startOfDay.toISOString()).lt("due_at", endOfDay.toISOString());
  } else if (view === "upcoming") {
    query = query.eq("status", "PENDING").gte("due_at", endOfDay.toISOString());
  } else if (view === "overdue") {
    query = query.eq("status", "PENDING").lt("due_at", startOfDay.toISOString());
  } else {
    query = query.eq("status", "DONE");
  }

  const { data } = await query.limit(100);
  const rows = (data ?? []) as FollowupRow[];

  // Enrich entity names for leads/customers.
  const leadIds = rows.filter((r) => r.entity_type === "lead").map((r) => r.entity_id);
  const customerIds = rows.filter((r) => r.entity_type === "customer").map((r) => r.entity_id);
  const oppIds = rows.filter((r) => r.entity_type === "opportunity").map((r) => r.entity_id);

  const names: Record<string, { name: string; mobile: string | null }> = {};
  if (leadIds.length) {
    const { data: leads } = await supabase.from("leads").select("id, name, mobile").in("id", leadIds);
    (leads ?? []).forEach((l) => (names[l.id] = { name: l.name, mobile: l.mobile }));
  }
  if (customerIds.length) {
    const { data: customers } = await supabase.from("customers").select("id, name, mobile").in("id", customerIds);
    (customers ?? []).forEach((c) => (names[c.id] = { name: c.name, mobile: c.mobile }));
  }
  if (oppIds.length) {
    const { data: opps } = await supabase.from("opportunities").select("id, name").in("id", oppIds);
    (opps ?? []).forEach((o) => (names[o.id] = { name: o.name, mobile: null }));
  }

  return rows.map((r) => ({
    ...r,
    entity_name: names[r.entity_id]?.name,
    entity_mobile: names[r.entity_id]?.mobile ?? null,
  }));
}