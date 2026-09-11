import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Activity } from "@/types/supabase";

export interface ActivityFeedRow extends Activity {
  entity_name?: string;
  entity_mobile?: string | null;
}

/** Most recent activities across the organization, with entity names attached. */
export async function listActivities(limit = 60): Promise<ActivityFeedRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("activities")
    .select("*")
    .order("performed_at", { ascending: false })
    .limit(limit);
  const rows = (data ?? []) as Activity[];

  const leadIds = rows.filter((a) => a.entity_type === "lead" && a.entity_id).map((a) => a.entity_id as string);
  const customerIds = rows.filter((a) => a.entity_type === "customer" && a.entity_id).map((a) => a.entity_id as string);
  const oppIds = rows.filter((a) => a.entity_type === "opportunity" && a.entity_id).map((a) => a.entity_id as string);
  const orderIds = rows.filter((a) => a.entity_type === "order" && a.entity_id).map((a) => a.entity_id as string);
  const quoteIds = rows.filter((a) => a.entity_type === "quotation" && a.entity_id).map((a) => a.entity_id as string);
  const invoiceIds = rows.filter((a) => a.entity_type === "invoice" && a.entity_id).map((a) => a.entity_id as string);

  const names: Record<string, { name: string; mobile: string | null }> = {};
  const enrich = (rowsArr: { id: string; name: string; mobile: string | null }[]) =>
    rowsArr.forEach((r) => (names[r.id] = { name: r.name, mobile: r.mobile }));

  if (leadIds.length) {
    const { data: d } = await supabase.from("leads").select("id, name, mobile").in("id", leadIds);
    enrich((d ?? []) as { id: string; name: string; mobile: string | null }[]);
  }
  if (customerIds.length) {
    const { data: d } = await supabase.from("customers").select("id, name, mobile").in("id", customerIds);
    enrich((d ?? []) as { id: string; name: string; mobile: string | null }[]);
  }
  if (oppIds.length) {
    const { data: d } = await supabase.from("opportunities").select("id, name").in("id", oppIds);
    enrich((d ?? []) as { id: string; name: string; mobile: string | null }[]);
  }
  if (orderIds.length) {
    const { data: d } = await supabase.from("orders").select("id, order_no").in("id", orderIds);
    enrich((d ?? []).map((o) => ({ id: o.id, name: o.order_no, mobile: null })));
  }
  if (quoteIds.length) {
    const { data: d } = await supabase.from("quotations").select("id, quote_no").in("id", quoteIds);
    enrich((d ?? []).map((q) => ({ id: q.id, name: q.quote_no, mobile: null })));
  }
  if (invoiceIds.length) {
    const { data: d } = await supabase.from("invoices").select("id, invoice_no").in("id", invoiceIds);
    enrich((d ?? []).map((i) => ({ id: i.id, name: i.invoice_no, mobile: null })));
  }

  return rows.map((a) => ({
    ...a,
    entity_name: a.entity_id ? names[a.entity_id]?.name : undefined,
    entity_mobile: a.entity_id ? (names[a.entity_id]?.mobile ?? null) : null,
  }));
}