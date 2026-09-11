"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit";
import { getUserContext, hasPermission } from "@/lib/auth";
import { PERM } from "@/lib/rbac";
import { computeLine, computeTotals } from "@/lib/tax";
import { recordInventoryTransaction } from "@/lib/ledger";
import {
  createProductSchema,
  updateProductSchema,
  createCategorySchema,
  createQuotationSchema,
  updateQuotationStatusSchema,
  createOrderSchema,
  updateOrderStatusSchema,
  createWarehouseSchema,
  inventoryAdjustSchema,
  inventoryTransferSchema,
} from "@/lib/validators";
import type { Json } from "@/types/supabase";

function fail(message: string) {
  return { success: false as const, error: message };
}
function ok(data?: unknown) {
  return { success: true as const, data };
}

async function sessionOrg(): Promise<{ userId: string; orgId: string; branchId: string | null } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase.from("users").select("id, organization_id").eq("id", user.id).maybeSingle();
  if (!profile?.organization_id) return null;

  const { data: firstBranch } = await supabase
    .from("user_branches")
    .select("branch_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  return { userId: user.id, orgId: profile.organization_id, branchId: firstBranch?.branch_id ?? null };
}

async function requirePermission(slug: string): Promise<boolean> {
  const ctx = await getUserContext();
  return hasPermission(ctx, slug);
}

async function nextDocNo(table: "quotations" | "orders", orgId: string, prefix: string): Promise<string> {
  const supabase = await createClient();
  const { count } = await supabase.from(table).select("id", { count: "exact", head: true }).eq("organization_id", orgId);
  return `${prefix}-${1000 + (count ?? 0) + 1}`;
}

async function productNamesByIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  productIds: string[]
): Promise<Record<string, string>> {
  if (!productIds.length) return {};
  const { data } = await supabase.from("products").select("id, name").in("id", [...new Set(productIds)]);
  return Object.fromEntries(((data ?? []) as { id: string; name: string }[]).map((p) => [p.id, p.name]));
}

const QUOTE_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["SENT"],
  SENT: ["VIEWED", "EXPIRED", "REJECTED"],
  VIEWED: ["ACCEPTED", "REJECTED", "EXPIRED"],
  ACCEPTED: [],
  REJECTED: [],
  EXPIRED: [],
  CONVERTED: [],
};

const ORDER_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["PACKED", "CANCELLED"],
  PACKED: ["DISPATCHED", "CANCELLED"],
  DISPATCHED: ["OUT_FOR_DELIVERY"],
  OUT_FOR_DELIVERY: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
  RETURNED: [],
};

// ------------------------------------------------------------------ products

export async function createProduct(_prev: unknown, formData: FormData) {
  const parsed = createProductSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the product details.");
  const ctx = await sessionOrg();
  if (!ctx) return fail("Not signed in.");
  if (!(await requirePermission(PERM.productCreate))) return fail("You don't have permission to create products.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .insert({ organization_id: ctx.orgId, ...parsed.data, created_by: ctx.userId })
    .select()
    .single();
  if (error) return fail("Could not create the product.");

  await writeAuditLog({
    action: "product.created",
    entity: "product",
    entity_id: data.id,
    new_value: { sku: data.sku, name: data.name },
    organization_id: ctx.orgId,
  });
  revalidatePath("/products");
  revalidatePath("/inventory");
  return ok({ id: data.id });
}

export async function updateProduct(id: string, _prev: unknown, formData: FormData) {
  const parsed = updateProductSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the product details.");
  const ctx = await sessionOrg();
  if (!ctx) return fail("Not signed in.");
  if (!(await requirePermission(PERM.productEdit))) return fail("You don't have permission to edit products.");

  const supabase = await createClient();
  const { data: existing } = await supabase.from("products").select("*").eq("id", id).maybeSingle();
  if (!existing) return fail("Product not found.");

  const { error } = await supabase
    .from("products")
    .update({ ...parsed.data, updated_by: ctx.userId })
    .eq("id", id);
  if (error) return fail("Could not update the product.");

  await writeAuditLog({
    action: "product.updated",
    entity: "product",
    entity_id: id,
    old_value: { name: existing.name },
    new_value: parsed.data as unknown as Json,
    organization_id: ctx.orgId,
  });
  revalidatePath("/products");
  revalidatePath(`/products/${id}`);
  revalidatePath("/inventory");
  return ok();
}

export async function createCategory(name: string) {
  const parsed = createCategorySchema.safeParse({ name });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the category name.");
  const ctx = await sessionOrg();
  if (!ctx) return fail("Not signed in.");
  if (!(await requirePermission(PERM.productCreate))) return fail("You don't have permission to create categories.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_categories")
    .insert({ organization_id: ctx.orgId, name: parsed.data.name })
    .select()
    .single();
  if (error) return fail("Could not create the category.");
  revalidatePath("/products");
  return ok({ id: data.id, name: data.name });
}

// -------------------------------------------------------------- quotations

export async function createQuotation(_prev: unknown, formData: FormData) {
  const entries = Object.fromEntries(formData);
  let items: unknown;
  try {
    items = JSON.parse(String(entries.items ?? "[]"));
  } catch {
    return fail("Line items are not valid.");
  }
  const parsed = createQuotationSchema.safeParse({ ...entries, items });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the quotation details.");
  const ctx = await sessionOrg();
  if (!ctx) return fail("Not signed in.");
  if (!(await requirePermission(PERM.quotationCreate))) return fail("You don't have permission to create quotations.");

  const supabase = await createClient();
  const lines = parsed.data.items.map((it) => {
    const line = computeLine({ quantity: it.quantity, unitPrice: it.unit_price, discountPercent: it.discount, taxRate: it.tax_rate });
    return { ...it, subtotal: line.subtotal, tax: line.tax, total: line.total };
  });
  const totals = computeTotals(lines);

  const productNames = await productNamesByIds(supabase, lines.map((l) => l.product_id));
  const quoteNo = await nextDocNo("quotations", ctx.orgId, "QT");
  const { data: quote, error } = await supabase
    .from("quotations")
    .insert({
      organization_id: ctx.orgId,
      branch_id: ctx.branchId,
      quote_no: quoteNo,
      customer_id: parsed.data.customer_id,
      lead_id: parsed.data.lead_id ?? null,
      date: parsed.data.date,
      valid_until: parsed.data.valid_until ?? null,
      salesperson_id: parsed.data.salesperson_id ?? ctx.userId,
      status: "DRAFT",
      ...totals,
      terms: parsed.data.terms ?? null,
      notes: parsed.data.notes ?? null,
      created_by: ctx.userId,
    })
    .select()
    .single();
  if (error) return fail("Could not create the quotation.");

  for (const l of lines) {
    const { error: itemError } = await supabase.from("quotation_items").insert({
      organization_id: ctx.orgId,
      quotation_id: quote.id,
      product_id: l.product_id,
      product_name: productNames[l.product_id] ?? "Item",
      quantity: l.quantity,
      unit_price: l.unit_price,
      discount: l.discount,
      tax_rate: l.tax_rate,
      line_total: l.total,
    });
    if (itemError) return fail("Could not save the quotation items.");
  }

  await writeAuditLog({
    action: "quotation.created",
    entity: "quotation",
    entity_id: quote.id,
    new_value: { quote_no: quoteNo, customer_id: quote.customer_id, total: quote.total },
    organization_id: ctx.orgId,
  });
  revalidatePath("/quotations");
  return ok({ id: quote.id });
}

export async function updateQuotationStatus(id: string, status: string) {
  const parsed = updateQuotationStatusSchema.safeParse({ status });
  if (!parsed.success) return fail("Invalid quotation status.");
  const ctx = await sessionOrg();
  if (!ctx) return fail("Not signed in.");

  const supabase = await createClient();
  const { data: quote } = await supabase.from("quotations").select("status").eq("id", id).maybeSingle();
  if (!quote) return fail("Quotation not found.");
  const allowed = QUOTE_TRANSITIONS[quote.status] ?? [];
  if (!allowed.includes(parsed.data.status)) {
    return fail(`Cannot move a ${quote.status} quotation to ${parsed.data.status}.`);
  }

  const { error } = await supabase
    .from("quotations")
    .update({ status: parsed.data.status, updated_by: ctx.userId })
    .eq("id", id);
  if (error) return fail("Could not update the quotation.");

  await writeAuditLog({
    action: "quotation.status_changed",
    entity: "quotation",
    entity_id: id,
    old_value: { status: quote.status },
    new_value: { status: parsed.data.status },
    organization_id: ctx.orgId,
  });
  revalidatePath("/quotations");
  revalidatePath(`/quotations/${id}`);
  return ok();
}

export async function convertQuotationToOrder(id: string) {
  const ctx = await sessionOrg();
  if (!ctx) return fail("Not signed in.");
  if (!(await requirePermission(PERM.quotationConvert))) return fail("You don't have permission to convert quotations.");

  const supabase = await createClient();
  const { data: quote } = await supabase.from("quotations").select("*").eq("id", id).maybeSingle();
  if (!quote) return fail("Quotation not found.");
  if (quote.status !== "ACCEPTED") return fail("Only accepted quotations can be converted to orders.");
  if (quote.converted_order_id) return fail("This quotation has already been converted.");

  const { data: items } = await supabase.from("quotation_items").select("*").eq("quotation_id", id);
  if (!items || items.length === 0) return fail("Quotation has no items.");

  const lines = items.map((it) => {
    const line = computeLine({ quantity: it.quantity, unitPrice: it.unit_price, discountPercent: it.discount, taxRate: it.tax_rate });
    return { ...it, subtotal: line.subtotal, tax: line.tax, total: line.total };
  });
  const totals = computeTotals(lines);

  const orderNo = await nextDocNo("orders", ctx.orgId, "ORD");
  const { data: order, error } = await supabase
    .from("orders")
    .insert({
      organization_id: ctx.orgId,
      branch_id: quote.branch_id ?? ctx.branchId,
      order_no: orderNo,
      customer_id: quote.customer_id,
      quote_id: quote.id,
      salesperson_id: quote.salesperson_id ?? ctx.userId,
      status: "DRAFT",
      ...totals,
      created_by: ctx.userId,
    })
    .select()
    .single();
  if (error) return fail("Could not create the order.");

  for (const l of lines) {
    const { error: itemError } = await supabase.from("order_items").insert({
      organization_id: ctx.orgId,
      order_id: order.id,
      product_id: l.product_id,
      product_name: l.product_name,
      quantity: l.quantity,
      unit_price: l.unit_price,
      discount: l.discount,
      tax_rate: l.tax_rate,
      line_total: l.total,
    });
    if (itemError) return fail("Could not save the order items.");
  }

  await supabase
    .from("quotations")
    .update({ status: "CONVERTED", converted_order_id: order.id, updated_by: ctx.userId })
    .eq("id", id);

  await writeAuditLog({
    action: "quotation.converted",
    entity: "quotation",
    entity_id: id,
    new_value: { order_id: order.id },
    organization_id: ctx.orgId,
  });
  revalidatePath("/quotations");
  revalidatePath(`/quotations/${id}`);
  revalidatePath("/orders");
  return ok({ id: order.id });
}

// ----------------------------------------------------------------- orders

export async function createOrder(_prev: unknown, formData: FormData) {
  const entries = Object.fromEntries(formData);
  let items: unknown;
  try {
    items = JSON.parse(String(entries.items ?? "[]"));
  } catch {
    return fail("Line items are not valid.");
  }
  const parsed = createOrderSchema.safeParse({ ...entries, items });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the order details.");
  const ctx = await sessionOrg();
  if (!ctx) return fail("Not signed in.");
  if (!(await requirePermission(PERM.orderCreate))) return fail("You don't have permission to create orders.");

  const supabase = await createClient();
  const lines = parsed.data.items.map((it) => {
    const line = computeLine({ quantity: it.quantity, unitPrice: it.unit_price, discountPercent: it.discount, taxRate: it.tax_rate });
    return { ...it, subtotal: line.subtotal, tax: line.tax, total: line.total };
  });
  const totals = computeTotals(lines);

  const productNames = await productNamesByIds(supabase, lines.map((l) => l.product_id));
  const orderNo = await nextDocNo("orders", ctx.orgId, "ORD");
  const { data: order, error } = await supabase
    .from("orders")
    .insert({
      organization_id: ctx.orgId,
      branch_id: ctx.branchId,
      order_no: orderNo,
      customer_id: parsed.data.customer_id,
      quote_id: parsed.data.quote_id ?? null,
      warehouse_id: parsed.data.warehouse_id ?? null,
      salesperson_id: parsed.data.salesperson_id ?? ctx.userId,
      status: "DRAFT",
      delivery_address: parsed.data.delivery_address ?? null,
      delivery_city: parsed.data.delivery_city ?? null,
      delivery_date: parsed.data.delivery_date ?? null,
      ...totals,
      notes: parsed.data.notes ?? null,
      created_by: ctx.userId,
    })
    .select()
    .single();
  if (error) return fail("Could not create the order.");

  for (const l of lines) {
    const { error: itemError } = await supabase.from("order_items").insert({
      organization_id: ctx.orgId,
      order_id: order.id,
      product_id: l.product_id,
      product_name: productNames[l.product_id] ?? "Item",
      quantity: l.quantity,
      unit_price: l.unit_price,
      discount: l.discount,
      tax_rate: l.tax_rate,
      line_total: l.total,
    });
    if (itemError) return fail("Could not save the order items.");
  }

  await writeAuditLog({
    action: "order.created",
    entity: "order",
    entity_id: order.id,
    new_value: { order_no: orderNo, customer_id: order.customer_id, total: order.total },
    organization_id: ctx.orgId,
  });
  revalidatePath("/orders");
  return ok({ id: order.id });
}

async function dispatchOrder(supabase: Awaited<ReturnType<typeof createClient>>, ctx: { userId: string; orgId: string; branchId: string | null }, orderId: string) {
  const { data: order } = await supabase.from("orders").select("*").eq("id", orderId).maybeSingle();
  if (!order) return;

  if (order.warehouse_id) {
    const { data: items } = await supabase.from("order_items").select("product_id, quantity").eq("order_id", orderId);
    for (const it of (items ?? []) as { product_id: string; quantity: number }[]) {
      const result = await recordInventoryTransaction({
        organizationId: ctx.orgId,
        warehouseId: order.warehouse_id,
        productId: it.product_id,
        type: "SALE",
        quantity: -Number(it.quantity),
        refType: "order",
        refId: orderId,
        note: `Stock deducted for order ${order.order_no}`,
        createdBy: ctx.userId,
      });
      if (!result.ok) return;
    }
  }

  const { data: delivery } = await supabase
    .from("deliveries")
    .insert({
      organization_id: ctx.orgId,
      order_id: orderId,
      status: "DISPATCHED",
      address: order.delivery_address ?? null,
      city: order.delivery_city ?? null,
      created_by: ctx.userId,
    })
    .select()
    .single();
  if (delivery) {
    await supabase.from("delivery_events").insert({
      organization_id: ctx.orgId,
      delivery_id: delivery.id,
      status: "DISPATCHED",
      note: "Order dispatched from warehouse",
      created_by: ctx.userId,
    });
  }
}

export async function updateOrderStatus(id: string, status: string) {
  const parsed = updateOrderStatusSchema.safeParse({ status });
  if (!parsed.success) return fail("Invalid order status.");
  const ctx = await sessionOrg();
  if (!ctx) return fail("Not signed in.");
  if (!(await requirePermission(PERM.orderApprove))) return fail("You don't have permission to update orders.");

  const supabase = await createClient();
  const { data: order } = await supabase.from("orders").select("status").eq("id", id).maybeSingle();
  if (!order) return fail("Order not found.");
  const allowed = ORDER_TRANSITIONS[order.status] ?? [];
  if (!allowed.includes(parsed.data.status)) {
    return fail(`Cannot move a ${order.status} order to ${parsed.data.status}.`);
  }

  const { error } = await supabase
    .from("orders")
    .update({ status: parsed.data.status, updated_by: ctx.userId })
    .eq("id", id);
  if (error) return fail("Could not update the order.");

  if (parsed.data.status === "DISPATCHED") {
    await dispatchOrder(supabase, ctx, id);
  }

  await writeAuditLog({
    action: "order.status_changed",
    entity: "order",
    entity_id: id,
    old_value: { status: order.status },
    new_value: { status: parsed.data.status },
    organization_id: ctx.orgId,
  });
  revalidatePath("/orders");
  revalidatePath(`/orders/${id}`);
  revalidatePath("/inventory");
  revalidatePath("/deliveries");
  return ok();
}

export async function cancelOrder(id: string) {
  const ctx = await sessionOrg();
  if (!ctx) return fail("Not signed in.");
  if (!(await requirePermission(PERM.orderCancel))) return fail("You don't have permission to cancel orders.");

  const supabase = await createClient();
  const { data: order } = await supabase.from("orders").select("status").eq("id", id).maybeSingle();
  if (!order) return fail("Order not found.");
  if (!ORDER_TRANSITIONS[order.status]?.includes("CANCELLED")) {
    return fail("This order cannot be cancelled at its current stage.");
  }

  const { error } = await supabase
    .from("orders")
    .update({ status: "CANCELLED", updated_by: ctx.userId })
    .eq("id", id);
  if (error) return fail("Could not cancel the order.");

  await writeAuditLog({
    action: "order.cancelled",
    entity: "order",
    entity_id: id,
    old_value: { status: order.status },
    new_value: { status: "CANCELLED" },
    organization_id: ctx.orgId,
  });
  revalidatePath("/orders");
  revalidatePath(`/orders/${id}`);
  return ok();
}

// --------------------------------------------------------------- inventory

export async function createWarehouse(_prev: unknown, formData: FormData) {
  const parsed = createWarehouseSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the warehouse details.");
  const ctx = await sessionOrg();
  if (!ctx) return fail("Not signed in.");
  if (!(await requirePermission(PERM.inventoryTransfer))) return fail("You don't have permission to create warehouses.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("warehouses")
    .insert({ organization_id: ctx.orgId, branch_id: parsed.data.branch_id ?? null, name: parsed.data.name, address: parsed.data.address ?? null })
    .select()
    .single();
  if (error) return fail("Could not create the warehouse.");

  await writeAuditLog({
    action: "warehouse.created",
    entity: "warehouse",
    entity_id: data.id,
    new_value: { name: data.name },
    organization_id: ctx.orgId,
  });
  revalidatePath("/inventory");
  revalidatePath("/warehouses");
  return ok({ id: data.id });
}

export async function adjustInventory(_prev: unknown, formData: FormData) {
  const parsed = inventoryAdjustSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the adjustment details.");
  const ctx = await sessionOrg();
  if (!ctx) return fail("Not signed in.");
  if (!(await requirePermission(PERM.inventoryAdjust))) return fail("You don't have permission to adjust inventory.");

  const result = await recordInventoryTransaction({
    organizationId: ctx.orgId,
    warehouseId: parsed.data.warehouse_id,
    productId: parsed.data.product_id,
    type: parsed.data.type,
    quantity: parsed.data.quantity,
    note: parsed.data.note ?? `Stock ${parsed.data.quantity > 0 ? "added" : "reduced"} (${parsed.data.type})`,
    createdBy: ctx.userId,
  });
  if (!result.ok) return fail(result.error);

  await writeAuditLog({
    action: "inventory.adjusted",
    entity: "inventory",
    entity_id: null,
    new_value: { warehouse_id: parsed.data.warehouse_id, product_id: parsed.data.product_id, type: parsed.data.type, quantity: parsed.data.quantity },
    organization_id: ctx.orgId,
  });
  revalidatePath("/inventory");
  revalidatePath("/stock-movement");
  return ok();
}

export async function transferInventory(_prev: unknown, formData: FormData) {
  const parsed = inventoryTransferSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the transfer details.");
  const ctx = await sessionOrg();
  if (!ctx) return fail("Not signed in.");
  if (!(await requirePermission(PERM.inventoryTransfer))) return fail("You don't have permission to transfer stock.");
  if (parsed.data.from_warehouse_id === parsed.data.to_warehouse_id) {
    return fail("Source and destination warehouses must be different.");
  }

  const qty = parsed.data.quantity;
  const note = parsed.data.note ?? `Transfer of ${qty}`;
  const out = await recordInventoryTransaction({
    organizationId: ctx.orgId,
    warehouseId: parsed.data.from_warehouse_id,
    productId: parsed.data.product_id,
    type: "TRANSFER_OUT",
    quantity: -qty,
    note,
    createdBy: ctx.userId,
  });
  if (!out.ok) return fail(out.error);

  const inResult = await recordInventoryTransaction({
    organizationId: ctx.orgId,
    warehouseId: parsed.data.to_warehouse_id,
    productId: parsed.data.product_id,
    type: "TRANSFER_IN",
    quantity: qty,
    note,
    createdBy: ctx.userId,
  });
  if (!inResult.ok) return fail(inResult.error);

  await writeAuditLog({
    action: "inventory.transferred",
    entity: "inventory",
    entity_id: null,
    new_value: {
      from_warehouse_id: parsed.data.from_warehouse_id,
      to_warehouse_id: parsed.data.to_warehouse_id,
      product_id: parsed.data.product_id,
      quantity: qty,
    },
    organization_id: ctx.orgId,
  });
  revalidatePath("/inventory");
  revalidatePath("/stock-movement");
  return ok();
}
