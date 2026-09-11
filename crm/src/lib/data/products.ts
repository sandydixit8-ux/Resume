import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Product, ProductCategory, ProductVariant } from "@/types/supabase";

export async function listProducts(params: { q?: string; categoryId?: string; isActive?: boolean; page?: number; pageSize?: number } = {}) {
  const supabase = await createClient();
  const page = params.page ?? 1;
  const pageSize = Math.min(params.pageSize ?? 20, 100);

  let query = supabase.from("products").select("*", { count: "exact" });
  if (params.q) {
    query = query.or(`name.ilike.%${params.q}%,sku.ilike.%${params.q}%`);
  }
  if (params.categoryId) {
    query = query.eq("category_id", params.categoryId);
  }
  if (params.isActive !== undefined) {
    query = query.eq("is_active", params.isActive);
  }
  const { data, count, error } = await query.order("created_at", { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
  if (error) throw new Error(error.message);
  return { products: (data ?? []) as Product[], total: count ?? 0, page, pageSize };
}

export async function listProductCategories(): Promise<ProductCategory[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("product_categories").select("*").order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as ProductCategory[];
}

export interface ProductPickerOption {
  id: string;
  sku: string;
  name: string;
  unit: string;
  selling_price: number;
  tax_rate: number;
}

/** Lightweight product list for quote/order line pickers. */
export async function listProductOptions(): Promise<ProductPickerOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, sku, name, unit, selling_price, tax_rate")
    .eq("is_active", true)
    .order("name")
    .limit(500);
  if (error) throw new Error(error.message);
  return (data ?? []) as ProductPickerOption[];
}

export interface ProductDetail {
  product: Product;
  categoryName: string | null;
  variants: ProductVariant[];
  stockRows: Array<{ warehouse_id: string; warehouse_name: string; quantity: number }>;
  totalStock: number;
}

export async function getProduct(id: string): Promise<ProductDetail | null> {
  const supabase = await createClient();
  const { data: product } = await supabase.from("products").select("*").eq("id", id).maybeSingle();
  if (!product) return null;

  const [categoryRes, variantsRes, stockRes] = await Promise.all([
    product.category_id
      ? supabase.from("product_categories").select("name").eq("id", product.category_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("product_variants").select("*").eq("product_id", id),
    supabase.from("inventory").select("warehouse_id, quantity").eq("product_id", id),
  ]);

  const stockRows = (stockRes.data ?? []) as { warehouse_id: string; quantity: number }[];
  const warehouseIds = [...new Set(stockRows.map((r) => r.warehouse_id))];
  let warehouseNames: Record<string, string> = {};
  if (warehouseIds.length) {
    const { data: w } = await supabase.from("warehouses").select("id, name").in("id", warehouseIds);
    warehouseNames = Object.fromEntries(((w ?? []) as { id: string; name: string }[]).map((x) => [x.id, x.name]));
  }

  return {
    product: product as Product,
    categoryName: (categoryRes.data as { name: string } | null)?.name ?? null,
    variants: (variantsRes.data ?? []) as ProductVariant[],
    stockRows: stockRows.map((r) => ({
      warehouse_id: r.warehouse_id,
      warehouse_name: warehouseNames[r.warehouse_id] ?? "Unknown",
      quantity: Number(r.quantity),
    })),
    totalStock: stockRows.reduce((s, r) => s + Number(r.quantity), 0),
  };
}
