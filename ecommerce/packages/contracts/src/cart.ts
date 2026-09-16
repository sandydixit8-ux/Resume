import type { PromotionTypeValue } from "./pricing";

export type CartItemDto = {
  id: string;
  variantId: string;
  productId: string;
  productName: string;
  variantName: string;
  sku: string;
  imageUrl?: string;
  unitPrice: string;
  basePrice: string;
  effectiveUnitPrice: string;
  mrp: string;
  quantity: number;
  lineTotal: string;
  promoDiscount: string;
  priceChanged: boolean;
  inStock: boolean;
  tierMinQuantity?: number;
  promotionId?: string;
  promotionName?: string;
  promotionType?: PromotionTypeValue;
};

export type CartTotalsDto = {
  subtotal: string;
  itemCount: number;
  savings: string;
  discount: string;
};

export type CartDto = {
  id: string;
  token?: string;
  items: CartItemDto[];
  totals: CartTotalsDto;
  updatedAt: string;
};