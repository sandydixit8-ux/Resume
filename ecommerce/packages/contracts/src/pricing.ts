export const PromotionTypeValues = ["PERCENTAGE_OFF", "FLAT_OFF"] as const;
export type PromotionTypeValue = (typeof PromotionTypeValues)[number];

export const PromotionScopeValues = ["ALL", "PRODUCT", "VARIANT"] as const;
export type PromotionScopeValue = (typeof PromotionScopeValues)[number];

export type PriceTierDto = {
  id: string;
  productVariantId: string;
  minQuantity: number;
  price: string;
  isActive: boolean;
  createdAt: string;
};

export type PriceTierInput = {
  minQuantity: number;
  price: number;
};

export type PriceTierResult = {
  variantId: string;
  basePrice: string;
  mrp: string;
  unitPrice: string;
  tierMinQuantity?: number;
};

export type PromotionItemDto = {
  id: string;
  productId?: string;
  productVariantId?: string;
};

export type PromotionDto = {
  id: string;
  name: string;
  type: PromotionTypeValue;
  scope: PromotionScopeValue;
  value: number;
  minQuantity: number;
  startAt: string;
  endAt: string;
  priority: number;
  active: boolean;
  status: "UPCOMING" | "RUNNING" | "ENDED" | "PAUSED";
  products: { id: string; name: string }[];
  variants: { id: string; sku: string; name: string }[];
  createdAt: string;
};

export type PromotionInput = {
  name: string;
  type: PromotionTypeValue;
  value: number;
  scope?: PromotionScopeValue;
  minQuantity?: number;
  startAt: string;
  endAt: string;
  priority?: number;
  isActive?: boolean;
  products?: string[];
  variants?: string[];
};

export type PromoMetaDto = {
  id: string;
  name: string;
  type: PromotionTypeValue;
  scope: PromotionScopeValue;
  value: number;
  minQuantity: number;
  endsAt: string;
};

export type QuoteRequestItem = {
  variantId: string;
  quantity: number;
};

export type LineQuoteDto = {
  variantId: string;
  productId: string;
  sku: string;
  variantName: string;
  productName: string;
  quantity: number;
  mrp: string;
  basePrice: string;
  unitPrice: string;
  tierMinQuantity?: number;
  promotionId?: string;
  promotionName?: string;
  promotionType?: PromotionTypeValue;
  promoDiscount: string;
  lineTotal: string;
};

export type QuoteDto = {
  items: LineQuoteDto[];
  subtotal: string;
  discount: string;
  savings: string;
};

export const PriceFieldValues = ["mrp", "sellingPrice", "price"] as const;
export type PriceFieldValue = (typeof PriceFieldValues)[number];

export type PriceHistoryEntryDto = {
  id: string;
  fieldName: string;
  fromValue: string;
  toValue: string;
  reason?: string;
  createdAt: string;
};

export type ProductPriceUpdateInput = {
  mrp?: number;
  sellingPrice?: number;
  reason?: string;
};

export type VariantPriceUpdateInput = {
  price?: number;
  mrp?: number;
  reason?: string;
};