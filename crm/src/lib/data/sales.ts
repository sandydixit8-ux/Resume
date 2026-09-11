import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Quotation, QuotationItem, Order, OrderItem, Delivery, DeliveryEvent, Customer } from "@/types/supabase";

function customerNamesFrom(rows: { id: string; name: string }[]): Record<string, string> {
  return Object.fromEntries(rows.map((r) => [r.id, r.name]));
}

export async function listQuotations(params: { q?: string; status?: string; customerId?: string; page?: number; pageSize?: number } = {}) {
  const supabase = await createClient();
  const page = params.page ?? 1;
  const pageSize = Math.min(params.pageSize ?? 20, 100);

  let query = supabase.from("quotations").select("*", { count: "exact" });
  if (params.status) query = query.eq("status", params.status as never);
  if (params.customerId) query = query.eq("customer_id", params.customerId);
  const { data, count, error } = await query.order("created_at", { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
  if (error) throw new Error(error.message);
  const quotations = (data ?? []) as Quotation[];

  const customerIds = [...new Set(quotations.map((q) => q.customer_id).filter((id): id is string => Boolean(id)))];
  let customerNames: Record<string, string> = {};
  if (customerIds.length) {
    const { data: c } = await supabase.from("customers").select("id, name").in("id", customerIds);
    customerNames = customerNamesFrom((c ?? []) as { id: string; name: string }[]);
  }
  if (params.q) {
    const q = params.q.toLowerCase();
    return {
      quotations: quotations.filter((x) => x.quote_no.toLowerCase().includes(q)),
      total: count ?? 0,
      page,
      pageSize,
      customerNames,
    };
  }
  return { quotations, total: count ?? 0, page, pageSize, customerNames };
}

export interface QuotationDetail {
  quotation: Quotation;
  items: QuotationItem[];
  customer: Customer | null;
  customerName: string | null;
  salespersonName: string | null;
}

export async function getQuotation(id: string): Promise<QuotationDetail | null> {
  const supabase = await createClient();
  const { data: quotation } = await supabase.from("quotations").select("*").eq("id", id).maybeSingle();
  if (!quotation) return null;

  const [itemsRes, customerRes, spRes] = await Promise.all([
    supabase.from("quotation_items").select("*").eq("quotation_id", id).order("id"),
    quotation.customer_id
      ? supabase.from("customers").select("*").eq("id", quotation.customer_id).maybeSingle()
      : Promise.resolve({ data: null }),
    quotation.salesperson_id
      ? supabase.from("users").select("full_name").eq("id", quotation.salesperson_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return {
    quotation: quotation as Quotation,
    items: (itemsRes.data ?? []) as QuotationItem[],
    customer: (customerRes.data as Customer | null) ?? null,
    customerName: (customerRes.data as Customer | null)?.name ?? null,
    salespersonName: (spRes.data as { full_name: string } | null)?.full_name ?? null,
  };
}

export async function listOrders(params: { q?: string; status?: string; page?: number; pageSize?: number } = {}) {
  const supabase = await createClient();
  const page = params.page ?? 1;
  const pageSize = Math.min(params.pageSize ?? 20, 100);

  let query = supabase.from("orders").select("*", { count: "exact" }).eq("is_deleted", false);
  if (params.status) query = query.eq("status", params.status as never);
  const { data, count, error } = await query.order("created_at", { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
  if (error) throw new Error(error.message);
  const orders = (data ?? []) as Order[];

  const customerIds = [...new Set(orders.map((o) => o.customer_id).filter((id): id is string => Boolean(id)))];
  let customerNames: Record<string, string> = {};
  if (customerIds.length) {
    const { data: c } = await supabase.from("customers").select("id, name").in("id", customerIds);
    customerNames = customerNamesFrom((c ?? []) as { id: string; name: string }[]);
  }
  if (params.q) {
    const q = params.q.toLowerCase();
    return { orders: orders.filter((x) => x.order_no.toLowerCase().includes(q)), total: count ?? 0, page, pageSize, customerNames };
  }
  return { orders, total: count ?? 0, page, pageSize, customerNames };
}

export interface OrderDetail {
  order: Order;
  items: OrderItem[];
  customer: Customer | null;
  customerName: string | null;
  salespersonName: string | null;
  quoteNo: string | null;
  delivery: Delivery | null;
}

export async function getOrder(id: string): Promise<OrderDetail | null> {
  const supabase = await createClient();
  const { data: order } = await supabase.from("orders").select("*").eq("id", id).eq("is_deleted", false).maybeSingle();
  if (!order) return null;

  const [itemsRes, customerRes, spRes, quoteRes, deliveryRes] = await Promise.all([
    supabase.from("order_items").select("*").eq("order_id", id).order("id"),
    order.customer_id
      ? supabase.from("customers").select("*").eq("id", order.customer_id).maybeSingle()
      : Promise.resolve({ data: null }),
    order.salesperson_id
      ? supabase.from("users").select("full_name").eq("id", order.salesperson_id).maybeSingle()
      : Promise.resolve({ data: null }),
    order.quote_id ? supabase.from("quotations").select("quote_no").eq("id", order.quote_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("deliveries").select("*").eq("order_id", id).maybeSingle(),
  ]);

  return {
    order: order as Order,
    items: (itemsRes.data ?? []) as OrderItem[],
    customer: (customerRes.data as Customer | null) ?? null,
    customerName: (customerRes.data as Customer | null)?.name ?? null,
    salespersonName: (spRes.data as { full_name: string } | null)?.full_name ?? null,
    quoteNo: (quoteRes.data as { quote_no: string } | null)?.quote_no ?? null,
    delivery: (deliveryRes.data as Delivery | null) ?? null,
  };
}

export interface DeliveryListRow {
  delivery: Delivery;
  order_no: string;
  customer_name: string;
}

export async function listDeliveries(params: { q?: string; status?: string; page?: number; pageSize?: number } = {}) {
  const supabase = await createClient();
  const page = params.page ?? 1;
  const pageSize = Math.min(params.pageSize ?? 20, 100);

  let query = supabase.from("deliveries").select("*", { count: "exact" });
  if (params.status) query = query.eq("status", params.status as never);
  const { data, count, error } = await query.order("created_at", { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
  if (error) throw new Error(error.message);
  const deliveries = (data ?? []) as Delivery[];

  const orderIds = [...new Set(deliveries.map((d) => d.order_id))];
  let orderInfo = new Map<string, { order_no: string; customer_name: string }>();
  if (orderIds.length) {
    const { data: orders } = await supabase.from("orders").select("id, order_no, customer_id").in("id", orderIds);
    const orderRows = (orders ?? []) as { id: string; order_no: string; customer_id: string }[];
    const customerIds = [...new Set(orderRows.map((o) => o.customer_id))];
    let names: Record<string, string> = {};
    if (customerIds.length) {
      const { data: c } = await supabase.from("customers").select("id, name").in("id", customerIds);
      names = customerNamesFrom((c ?? []) as { id: string; name: string }[]);
    }
    orderInfo = new Map(orderRows.map((o) => [o.id, { order_no: o.order_no, customer_name: names[o.customer_id] ?? "Unknown" }]));
  }

  const rows: DeliveryListRow[] = deliveries.map((d) => ({
    delivery: d,
    order_no: orderInfo.get(d.order_id)?.order_no ?? "-",
    customer_name: orderInfo.get(d.order_id)?.customer_name ?? "Unknown",
  }));

  return { rows, total: count ?? 0, page, pageSize };
}

export interface DeliveryDetail {
  delivery: Delivery;
  events: DeliveryEvent[];
  order_no: string;
  customer_name: string;
}

export async function getDelivery(id: string): Promise<DeliveryDetail | null> {
  const supabase = await createClient();
  const { data: delivery } = await supabase.from("deliveries").select("*").eq("id", id).maybeSingle();
  if (!delivery) return null;

  const [eventsRes, orderRes, customerRes] = await Promise.all([
    supabase.from("delivery_events").select("*").eq("delivery_id", id).order("at"),
    supabase.from("orders").select("order_no, customer_id").eq("id", delivery.order_id).maybeSingle(),
    supabase
      .from("orders")
      .select("customer_id")
      .eq("id", delivery.order_id)
      .maybeSingle()
      .then(async (o) => {
        if (!o.data) return { data: null };
        return supabase.from("customers").select("name").eq("id", o.data.customer_id).maybeSingle();
      }),
  ]);

  return {
    delivery: delivery as Delivery,
    events: (eventsRes.data ?? []) as DeliveryEvent[],
    order_no: (orderRes.data as { order_no: string } | null)?.order_no ?? "-",
    customer_name: (customerRes.data as { name: string } | null)?.name ?? "Unknown",
  };
}

export interface CustomerOption {
  id: string;
  name: string;
  customer_no: string;
  mobile: string | null;
}

export async function listCustomerOptions(): Promise<CustomerOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .select("id, name, customer_no, mobile")
    .eq("is_deleted", false)
    .order("name")
    .limit(500);
  if (error) throw new Error(error.message);
  return (data ?? []) as CustomerOption[];
}
