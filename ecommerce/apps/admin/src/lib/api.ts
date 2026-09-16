import {
  BrandDto,
  CategoryNode,
  Facets,
  InventoryAdjustInput,
  InventoryCreateTransferInput,
  InventoryRowDto,
  InventoryTransferDto,
  InventoryTransferStatusValue,
  OrderDto,
  OrderSummaryDto,
  PaginationMeta,
  PriceHistoryEntryDto,
  PriceTierDto,
  PriceTierInput,
  ProductDetail,
  ProductPriceUpdateInput,
  ProductListResult,
  ProductStatus,
  ProductSummary,
  PromotionDto,
  PromotionInput,
  ReorderRowDto,
  WarehouseCreateInput,
  WarehouseDto,
} from "@nexus/contracts";
import { getStoredToken } from "@/lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export type ApiError = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  requestId?: string;
};

type ApiEnvelope = {
  success: boolean;
  data: unknown;
  meta?: Record<string, unknown>;
  facets?: unknown;
};

export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
    readonly requestId?: string,
  ) {
    super(message);
  }
}

async function adminFetchEnvelope(path: string, options: RequestInit = {}): Promise<ApiEnvelope> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    let error: ApiError = { code: "INTERNAL_ERROR", message: `Request failed (${res.status})` };
    try {
      const body = (await res.json()) as { error?: ApiError };
      if (body.error) error = body.error;
    } catch {
      /* non-json body */
    }
    throw new ApiClientError(res.status, error.code, error.message, error.details, error.requestId);
  }

  const text = await res.text();
  const body: ApiEnvelope = text ? (JSON.parse(text) as ApiEnvelope) : { success: true, data: undefined };
  if (!body.success) throw new ApiClientError(res.status, "INTERNAL_ERROR", "Unexpected response");
  return body;
}

export async function adminFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const body = await adminFetchEnvelope(path, options);
  return body.data as T;
}

export type AdminProductCreateInput = {
  sku: string;
  name: string;
  categoryId: string;
  brandId?: string;
  mrp: number;
  sellingPrice: number;
  currency?: string;
  status?: ProductStatus;
  shortDescription?: string;
  description?: string;
  attributes?: { attributeId: string; attributeValueId: string }[];
};

const toQuery = (query: Record<string, string | number | boolean | undefined>): string => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
};

export const adminCatalogApi = {
  listProducts: (query: { q?: string; status?: ProductStatus; page?: number; pageSize?: number } = {}): Promise<
    { data: ProductSummary[]; meta: PaginationMeta; facets: Facets }
  > =>
    adminFetchEnvelope(`/admin/products${toQuery(query)}`).then((body) => ({
      data: body.data as ProductSummary[],
      meta: (body.meta ?? {}) as PaginationMeta,
      facets: (body.facets ?? { brands: [], attributes: [], price: { min: "0", max: "0" } }) as Facets,
    })),

  createProduct: (input: AdminProductCreateInput): Promise<ProductSummary> =>
    adminFetch<ProductSummary>("/admin/products", { method: "POST", body: JSON.stringify(input) }),

  deleteProduct: (id: string): Promise<void> =>
    adminFetch<void>(`/admin/products/${id}`, { method: "DELETE" }),

  getCategories: (): Promise<CategoryNode[]> => adminFetch<CategoryNode[]>("/categories"),

  getProduct: (slug: string): Promise<ProductDetail> =>
    adminFetch<ProductDetail>(`/products/${encodeURIComponent(slug)}`),

  createCategory: (input: {
    name: string;
    slug?: string;
    parentId?: string;
    imageUrl?: string;
    description?: string;
    isActive?: boolean;
  }): Promise<{ id: string }> => adminFetch<{ id: string }>("/admin/categories", {
    method: "POST",
    body: JSON.stringify(input),
  }),

  deleteCategory: (id: string): Promise<void> =>
    adminFetch<void>(`/admin/categories/${id}`, { method: "DELETE" }),

  getBrands: (): Promise<BrandDto[]> => adminFetch<BrandDto[]>("/brands"),

  getAttributes: (): Promise<{ id: string; code: string; name: string; values: { id: string; value: string; slug: string }[] }[]> =>
    adminFetch<{ id: string; code: string; name: string; values: { id: string; value: string; slug: string }[] }[]>("/attributes"),
};

export const adminOrdersApi = {
  listOrders: (query: { page?: number; pageSize?: number; status?: string } = {}) =>
    adminFetchEnvelope(`/admin/orders${toQuery(query)}`).then((body) => ({
      data: (body.data ?? []) as OrderSummaryDto[],
      meta: (body.meta ?? {}) as PaginationMeta,
    })),

  getOrder: (id: string): Promise<OrderDto> =>
    adminFetch<OrderDto>(`/admin/orders/${encodeURIComponent(id)}`),

  updateStatus: (id: string, toStatus: string, reason?: string): Promise<OrderDto> =>
    adminFetch<OrderDto>(`/admin/orders/${encodeURIComponent(id)}/status`, {
      method: "PATCH",
      body: JSON.stringify({ toStatus, reason }),
    }),
};

export const adminInventoryApi = {
  listWarehouses: (): Promise<WarehouseDto[]> =>
    adminFetch<WarehouseDto[]>("/admin/warehouses"),

  createWarehouse: (input: WarehouseCreateInput): Promise<WarehouseDto> =>
    adminFetch<WarehouseDto>("/admin/warehouses", { method: "POST", body: JSON.stringify(input) }),

  listInventory: (query: { warehouseId?: string; lowStockOnly?: boolean } = {}) =>
    adminFetchEnvelope(`/admin/inventory${toQuery(query)}`).then((body) => ({
      data: (body.data ?? []) as InventoryRowDto[],
      meta: (body.meta ?? {}) as PaginationMeta,
    })),

  adjustStock: (input: InventoryAdjustInput): Promise<InventoryRowDto> =>
    adminFetch<InventoryRowDto>("/admin/inventory/adjust", {
      method: "PATCH",
      body: JSON.stringify(input),
    }),

  updateReorderConfig: (id: string, input: { reorderPoint?: number; reorderQuantity?: number }): Promise<InventoryRowDto> =>
    adminFetch<InventoryRowDto>(`/admin/inventory/${encodeURIComponent(id)}/reorder`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),

  createTransfer: (input: InventoryCreateTransferInput): Promise<InventoryTransferDto> =>
    adminFetch<InventoryTransferDto>("/admin/inventory/transfers", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  listTransfers: (query: {
    page?: number;
    pageSize?: number;
    status?: InventoryTransferStatusValue;
  } = {}) =>
    adminFetchEnvelope(`/admin/inventory/transfers${toQuery(query)}`).then((body) => ({
      data: (body.data ?? []) as InventoryTransferDto[],
      meta: (body.meta ?? {}) as PaginationMeta,
    })),

  getReorderReport: (): Promise<ReorderRowDto[]> =>
    adminFetch<ReorderRowDto[]>("/admin/inventory/reorder-report"),
};

export const adminPricingApi = {
  updateProductPrice: (id: string, input: ProductPriceUpdateInput): Promise<{
    mrp: string;
    sellingPrice: string;
    history: PriceHistoryEntryDto[];
  }> =>
    adminFetch<{ mrp: string; sellingPrice: string; history: PriceHistoryEntryDto[] }>(
      `/admin/products/${encodeURIComponent(id)}/price`,
      { method: "PATCH", body: JSON.stringify(input) },
    ),

  listTiers: (variantId: string): Promise<PriceTierDto[]> =>
    adminFetch<PriceTierDto[]>(`/admin/variants/${encodeURIComponent(variantId)}/tiers`),

  upsertTier: (variantId: string, input: PriceTierInput): Promise<PriceTierDto> =>
    adminFetch<PriceTierDto>(`/admin/variants/${encodeURIComponent(variantId)}/tiers`, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  deleteTier: (variantId: string, tierId: string): Promise<void> =>
    adminFetch<void>(
      `/admin/variants/${encodeURIComponent(variantId)}/tiers/${encodeURIComponent(tierId)}`,
      { method: "DELETE" },
    ),

  listPromotions: (): Promise<PromotionDto[]> => adminFetch<PromotionDto[]>("/admin/promotions"),

  createPromotion: (input: PromotionInput): Promise<PromotionDto> =>
    adminFetch<PromotionDto>("/admin/promotions", { method: "POST", body: JSON.stringify(input) }),

  updatePromotion: (id: string, input: PromotionInput): Promise<PromotionDto> =>
    adminFetch<PromotionDto>(`/admin/promotions/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),

  deletePromotion: (id: string): Promise<void> =>
    adminFetch<void>(`/admin/promotions/${encodeURIComponent(id)}`, { method: "DELETE" }),
};