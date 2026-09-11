import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { InventoryRow, InventoryTransaction, Warehouse } from "@/types/supabase";

export async function listWarehouses(): Promise<Warehouse[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("warehouses").select("*").order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as Warehouse[];
}

export interface InventoryListRow {
  inventory: InventoryRow;
  product: { id: string; name: string; sku: string; unit: string; min_stock: number; tax_rate: number };
  warehouse: { id: string; name: string };
  lowStock: boolean;
}

export async function listInventory(params: { q?: string; warehouseId?: string; lowOnly?: boolean; page?: number; pageSize?: number } = {}) {
  const supabase = await createClient();
  const page = params.page ?? 1;
  const pageSize = Math.min(params.pageSize ?? 20, 100);

  let query = supabase.from("inventory").select("*", { count: "exact" });
  if (params.warehouseId) query = query.eq("warehouse_id", params.warehouseId);
  const { data, count, error } = await query.order("updated_at", { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as InventoryRow[];

  const [productsRes, warehousesRes] = await Promise.all([
    supabase.from("products").select("id, name, sku, unit, min_stock, tax_rate"),
    supabase.from("warehouses").select("id, name"),
  ]);
  const products = (productsRes.data ?? []) as { id: string; name: string; sku: string; unit: string; min_stock: number; tax_rate: number }[];
  const warehouses = (warehousesRes.data ?? []) as { id: string; name: string }[];
  const productMap = new Map(products.map((p) => [p.id, p]));
  const warehouseMap = new Map(warehouses.map((w) => [w.id, w]));

  let out: InventoryListRow[] = rows.map((r) => {
    const p = productMap.get(r.product_id);
    return {
      inventory: r,
      product: {
        id: p?.id ?? r.product_id,
        name: p?.name ?? "Unknown product",
        sku: p?.sku ?? "-",
        unit: p?.unit ?? "piece",
        min_stock: Number(p?.min_stock ?? 0),
        tax_rate: Number(p?.tax_rate ?? 0),
      },
      warehouse: { id: r.warehouse_id, name: warehouseMap.get(r.warehouse_id)?.name ?? "Unknown" },
      lowStock: Number(r.quantity) <= Number(p?.min_stock ?? 0),
    };
  });

  if (params.q) {
    const q = params.q.toLowerCase();
    out = out.filter((r) => r.product.name.toLowerCase().includes(q) || r.product.sku.toLowerCase().includes(q));
  }
  if (params.lowOnly) out = out.filter((r) => r.lowStock);

  return { rows: out, total: count ?? 0, page, pageSize };
}

export interface StockMovementRow {
  txn: InventoryTransaction;
  product_name: string;
  product_sku: string;
  warehouse_name: string;
}

export async function listStockMovements(params: { q?: string; type?: string; page?: number; pageSize?: number } = {}) {
  const supabase = await createClient();
  const page = params.page ?? 1;
  const pageSize = Math.min(params.pageSize ?? 20, 100);

  let query = supabase.from("inventory_transactions").select("*", { count: "exact" });
  if (params.type) query = query.eq("type", params.type as never);
  const { data, count, error } = await query.order("created_at", { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
  if (error) throw new Error(error.message);
  const txns = (data ?? []) as InventoryTransaction[];

  const productIds = [...new Set(txns.map((t) => t.product_id))];
  const warehouseIds = [...new Set(txns.map((t) => t.warehouse_id))];
  const [productsRes, warehousesRes] = await Promise.all([
    productIds.length ? supabase.from("products").select("id, name, sku").in("id", productIds) : Promise.resolve({ data: [] }),
    warehouseIds.length ? supabase.from("warehouses").select("id, name").in("id", warehouseIds) : Promise.resolve({ data: [] }),
  ]);
  const productMap = new Map((productsRes.data ?? []).map((p) => [p.id, p]));
  const warehouseMap = new Map((warehousesRes.data ?? []).map((w) => [w.id, w]));

  const rows: StockMovementRow[] = txns.map((t) => ({
    txn: t,
    product_name: productMap.get(t.product_id)?.name ?? "Unknown product",
    product_sku: productMap.get(t.product_id)?.sku ?? "-",
    warehouse_name: warehouseMap.get(t.warehouse_id)?.name ?? "Unknown",
  }));

  if (params.q) {
    const q = params.q.toLowerCase();
    const filtered = rows.filter((r) => r.product_name.toLowerCase().includes(q) || r.product_sku.toLowerCase().includes(q));
    return { rows: filtered, total: count ?? 0, page, pageSize };
  }
  return { rows, total: count ?? 0, page, pageSize };
}

export async function getInventoryStats(): Promise<{ lowStockCount: number; totalProducts: number; warehouses: number }> {
  const supabase = await createClient();
  const [productsRes, inventoryRes, warehousesRes] = await Promise.all([
    supabase.from("products").select("id, min_stock"),
    supabase.from("inventory").select("product_id, quantity"),
    supabase.from("warehouses").select("id", { count: "exact", head: true }),
  ]);
  const products = (productsRes.data ?? []) as { id: string; min_stock: number }[];
  const inventory = (inventoryRes.data ?? []) as { product_id: string; quantity: number }[];
  const stockByProduct = new Map<string, number>();
  for (const r of inventory) {
    stockByProduct.set(r.product_id, (stockByProduct.get(r.product_id) ?? 0) + Number(r.quantity));
  }
  const lowStockCount = products.filter((p) => (stockByProduct.get(p.id) ?? 0) <= Number(p.min_stock)).length;
  return {
    lowStockCount,
    totalProducts: products.length,
    warehouses: warehousesRes.count ?? 0,
  };
}
