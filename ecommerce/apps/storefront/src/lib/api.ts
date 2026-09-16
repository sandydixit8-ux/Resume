import {
  BrandDto,
  CartDto,
  CategoryNode,
  CollectionDto,
  CurrentUser,
  Facets,
  LoginResponse,
  OrderDto,
  OrderListResult,
  PaginationMeta,
  PlaceOrderRequest,
  PlaceOrderResult,
  ProductDetail,
  ProductListQuery,
  ProductListResult,
  ProductSummary,
  RegisterRequest,
  RegisterResponse,
  VariantAvailabilityDto,
} from "@nexus/contracts";

export type ApiError = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  requestId?: string;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

const TOKEN_KEY = "nexus_access_token";

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null): void {
  if (typeof window === "undefined") return;
  if (token) {
    window.localStorage.setItem(TOKEN_KEY, token);
  } else {
    window.localStorage.removeItem(TOKEN_KEY);
  }
}

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

type ApiEnvelope = {
  success: boolean;
  data: unknown;
  meta?: Record<string, unknown>;
  facets?: unknown;
};

const CART_TOKEN_KEY = "nexus_cart_token";

export function getCartToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(CART_TOKEN_KEY);
}

export function setCartToken(token: string | null): void {
  if (typeof window === "undefined") return;
  if (token) {
    window.localStorage.setItem(CART_TOKEN_KEY, token);
  } else {
    window.localStorage.removeItem(CART_TOKEN_KEY);
  }
}

export async function fetchEnvelope(path: string, options: RequestInit = {}): Promise<ApiEnvelope> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });

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

  const body = (await res.json()) as ApiEnvelope;
  if (!body.success) {
    throw new ApiClientError(res.status, "INTERNAL_ERROR", "Unexpected response");
  }
  return body;
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const body = await fetchEnvelope(path, options);
  return body.data as T;
}

export const authApi = {
  register: (input: RegisterRequest): Promise<RegisterResponse> =>
    apiFetch<RegisterResponse>("/auth/register", { method: "POST", body: JSON.stringify(input) }),

  login: (email: string, password: string): Promise<LoginResponse & { refreshToken: string }> =>
    apiFetch<LoginResponse & { refreshToken: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  me: (): Promise<CurrentUser> => apiFetch<CurrentUser>("/users/me"),

  logout: (): Promise<void> => apiFetch<void>("/auth/logout", { method: "POST" }),
};

const toQuery = (query: ProductListQuery): string => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "" && value !== 0) {
      params.set(key, String(value));
    }
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
};

export const catalogApi = {
  listProducts: async (query: ProductListQuery = {}): Promise<ProductListResult> => {
    const body = await fetchEnvelope(`/products${toQuery(query)}`);
    return {
      data: body.data as ProductSummary[],
      meta: (body.meta ?? {}) as PaginationMeta,
      facets: (body.facets ?? { brands: [], attributes: [], price: { min: "0", max: "0" } }) as Facets,
    };
  },

  getProduct: (slug: string): Promise<ProductDetail> =>
    apiFetch<ProductDetail>(`/products/${encodeURIComponent(slug)}`),

  getCategories: (): Promise<CategoryNode[]> => apiFetch<CategoryNode[]>("/categories"),

  getBrands: (): Promise<BrandDto[]> => apiFetch<BrandDto[]>("/brands"),

  getCollections: (): Promise<CollectionDto[]> => apiFetch<CollectionDto[]>("/collections"),
};

export const inventoryApi = {
  getAvailability: (variantIds: string[]): Promise<Record<string, VariantAvailabilityDto>> => {
    const qs = variantIds.length > 0 ? `?variantIds=${variantIds.map(encodeURIComponent).join(",")}` : "";
    return apiFetch<Record<string, VariantAvailabilityDto>>(`/inventory/availability${qs}`);
  },
};

function hasCartToken(value: unknown): value is CartDto {
  return (value as CartDto)?.token !== undefined;
}

async function cartEnvelope(
  path: string,
  init: {
    method?: string;
    body?: Record<string, unknown>;
  } = {},
): Promise<CartDto> {
  const token = getCartToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["x-cart-token"] = token;
  const body = await fetchEnvelope(path, {
    method: init.method ?? "GET",
    headers,
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const data = body.data as CartDto;
  if (hasCartToken(data) && data.token) setCartToken(data.token);
  return data;
}

export const cartApi = {
  getCart: (): Promise<CartDto> => cartEnvelope("/cart"),

  addItem: (variantId: string, quantity: number): Promise<CartDto> =>
    cartEnvelope("/cart/items", { method: "POST", body: { variantId, quantity } }),

  updateItem: (itemId: string, quantity: number): Promise<CartDto> =>
    cartEnvelope(`/cart/items/${encodeURIComponent(itemId)}`, {
      method: "PATCH",
      body: { quantity },
    }),

  removeItem: (itemId: string): Promise<CartDto> =>
    cartEnvelope(`/cart/items/${encodeURIComponent(itemId)}`, { method: "DELETE" }),

  clearCart: (): Promise<CartDto> => cartEnvelope("/cart", { method: "DELETE" }),

  mergeCart: (): Promise<CartDto> => cartEnvelope("/cart/merge", { method: "POST" }),
};

export const checkoutApi = {
  placeGuestOrder: (input: PlaceOrderRequest): Promise<PlaceOrderResult> =>
    apiFetch<PlaceOrderResult>("/checkout/place-order/guest", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  placeOrder: (input: PlaceOrderRequest): Promise<PlaceOrderResult> =>
    apiFetch<PlaceOrderResult>("/checkout/place-order", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  findSession: (sessionId: string): Promise<PlaceOrderResult> =>
    apiFetch<PlaceOrderResult>(`/checkout/sessions/${encodeURIComponent(sessionId)}`),
};

export const ordersApi = {
  listMyOrders: async (query: { page?: number; pageSize?: number; status?: string } = {}) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
    }
    const qs = params.toString();
    return apiFetch<OrderListResult>(`/users/me/orders${qs ? `?${qs}` : ""}`);
  },

  getMyOrder: (orderId: string): Promise<OrderDto> =>
    apiFetch<OrderDto>(`/users/me/orders/${encodeURIComponent(orderId)}`),

  cancelMyOrder: (orderId: string, reason?: string): Promise<OrderDto> =>
    apiFetch<OrderDto>(`/users/me/orders/${encodeURIComponent(orderId)}/cancel`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
};