import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Customer, Activity, Order, Quotation, Invoice } from "@/types/supabase";

export async function listCustomers(params: { q?: string; page?: number; pageSize?: number } = {}) {
  const supabase = await createClient();
  const page = params.page ?? 1;
  const pageSize = Math.min(params.pageSize ?? 20, 100);

  let query = supabase.from("customers").select("*", { count: "exact" }).eq("is_deleted", false);
  if (params.q) {
    query = query.or(`name.ilike.%${params.q}%,company.ilike.%${params.q}%,mobile.ilike.%${params.q}%,email.ilike.%${params.q}%`);
  }
  const { data, count, error } = await query.order("created_at", { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
  if (error) throw new Error(error.message);
  return { customers: (data ?? []) as Customer[], total: count ?? 0, page, pageSize };
}

export interface CustomerSummary {
  totalOrders: number;
  totalRevenue: number;
  outstanding: number;
  lastOrder: string | null;
  openOpportunities: number;
}

export async function getCustomerSummary(customerId: string): Promise<CustomerSummary> {
  const supabase = await createClient();
  const [ordersRes, invoicesRes, oppsRes] = await Promise.all([
    supabase.from("orders").select("created_at").eq("customer_id", customerId).eq("is_deleted", false).order("created_at", { ascending: false }),
    supabase.from("invoices").select("total, paid_amount, status").eq("customer_id", customerId),
    supabase.from("opportunities").select("id", { count: "exact", head: true }).eq("customer_id", customerId).eq("status", "OPEN"),
  ]);

  const orders = (ordersRes.data ?? []) as { created_at: string }[];
  const invoices = (invoicesRes.data ?? []) as { total: number; paid_amount: number; status: string }[];
  const totalRevenue = invoices.filter((i) => i.status === "PAID").reduce((s, i) => s + Number(i.total || 0), 0);
  const outstanding = invoices
    .filter((i) => ["ISSUED", "PARTIALLY_PAID", "OVERDUE"].includes(i.status))
    .reduce((s, i) => s + (Number(i.total || 0) - Number(i.paid_amount || 0)), 0);

  return {
    totalOrders: orders.length,
    totalRevenue,
    outstanding,
    lastOrder: orders[0]?.created_at ?? null,
    openOpportunities: oppsRes.count ?? 0,
  };
}

export interface CustomerDetail {
  customer: Customer;
  summary: CustomerSummary;
  activities: Activity[];
  orders: Order[];
  quotations: Quotation[];
  invoices: Invoice[];
  ownerName: string | null;
}

export async function getCustomerDetail(id: string): Promise<CustomerDetail | null> {
  const supabase = await createClient();
  const { data: customer } = await supabase.from("customers").select("*").eq("id", id).eq("is_deleted", false).maybeSingle();
  if (!customer) return null;

  const [summary, activitiesRes, ordersRes, quotationsRes, invoicesRes, ownerRes] = await Promise.all([
    getCustomerSummary(id),
    supabase.from("activities").select("*").eq("entity_type", "customer").eq("entity_id", id).order("performed_at", { ascending: false }).limit(100),
    supabase.from("orders").select("*").eq("customer_id", id).order("created_at", { ascending: false }).limit(50),
    supabase.from("quotations").select("*").eq("customer_id", id).order("created_at", { ascending: false }).limit(20),
    supabase.from("invoices").select("*").eq("customer_id", id).order("created_at", { ascending: false }).limit(20),
    customer.assigned_to
      ? supabase.from("users").select("full_name").eq("id", customer.assigned_to).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return {
    customer: customer as Customer,
    summary,
    activities: (activitiesRes.data ?? []) as Activity[],
    orders: (ordersRes.data ?? []) as Order[],
    quotations: (quotationsRes.data ?? []) as Quotation[],
    invoices: (invoicesRes.data ?? []) as Invoice[],
    ownerName: (ownerRes.data as { full_name: string } | null)?.full_name ?? null,
  };
}