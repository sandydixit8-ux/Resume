import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Visit } from "@/types/supabase";

export interface VisitRow extends Visit {
  customer_name?: string;
  customer_mobile?: string | null;
  visit_by_name?: string;
}

/** Field visits, newest first, with customer + visit-by names attached. */
export async function listVisits(limit = 60): Promise<VisitRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("visits").select("*").order("scheduled_at", { ascending: false }).limit(limit);
  const rows = (data ?? []) as Visit[];

  const customerIds = rows.filter((v) => v.customer_id).map((v) => v.customer_id as string);
  const userIds = rows.filter((v) => v.visit_by).map((v) => v.visit_by as string);

  const customerNames: Record<string, { name: string; mobile: string | null }> = {};
  if (customerIds.length) {
    const { data: d } = await supabase.from("customers").select("id, name, mobile").in("id", customerIds);
    (d ?? []).forEach((c) => (customerNames[c.id] = { name: c.name, mobile: c.mobile }));
  }

  const userNames: Record<string, string> = {};
  if (userIds.length) {
    const { data: d } = await supabase.from("users").select("id, full_name").in("id", userIds);
    (d ?? []).forEach((u) => (userNames[u.id] = u.full_name));
  }

  return rows.map((v) => ({
    ...v,
    customer_name: v.customer_id ? customerNames[v.customer_id]?.name : undefined,
    customer_mobile: v.customer_id ? (customerNames[v.customer_id]?.mobile ?? null) : null,
    visit_by_name: v.visit_by ? userNames[v.visit_by] : undefined,
  }));
}

export interface VisitCustomerOption {
  id: string;
  name: string;
  mobile: string | null;
}

/** Customers used to pick the subject of a field visit. */
export async function getVisitCustomerOptions(): Promise<VisitCustomerOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("customers")
    .select("id, name, mobile")
    .eq("is_deleted", false)
    .order("created_at", { ascending: false })
    .limit(100);
  return (data ?? []) as VisitCustomerOption[];
}