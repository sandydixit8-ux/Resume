import type { PaginationMeta } from "./errors";

export const OrderStatusValues = [
  "PLACED",
  "PAYMENT_PENDING",
  "CONFIRMED",
  "PROCESSING",
  "PACKED",
  "SHIPPED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
  "PAYMENT_FAILED",
  "RETURN_REQUESTED",
  "RETURN_APPROVED",
  "PICKUP_SCHEDULED",
  "RETURNED",
  "REFUND_PENDING",
  "REFUNDED",
] as const;

export type OrderStatusValue = (typeof OrderStatusValues)[number];

export const PaymentMethodValues = [
  "UPI",
  "CREDIT_CARD",
  "DEBIT_CARD",
  "NET_BANKING",
  "WALLET",
  "COD",
  "EMI",
  "PAYMENT_LINK",
] as const;

export type PaymentMethodValue = (typeof PaymentMethodValues)[number];

export type ShippingAddressInput = {
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  country?: string;
};

export type PlaceOrderRequest = {
  cartToken?: string;
  email?: string;
  phone?: string;
  shippingAddress: ShippingAddressInput;
  paymentMethod: PaymentMethodValue;
  idempotencyKey: string;
};

export type OrderItemDto = {
  id: string;
  productId: string;
  variantId: string;
  name: string;
  variantName?: string;
  sku: string;
  imageUrl?: string;
  quantity: number;
  unitPrice: string;
  mrp: string;
  discount: string;
  promoDiscount: string;
  promotionId?: string;
  promotionName?: string;
  promotionType?: string;
  tierMinQuantity?: number;
  taxRate: string;
  taxAmount: string;
  lineTotal: string;
  status: string;
};

export type OrderTotalsDto = {
  subtotal: string;
  discountTotal: string;
  taxTotal: string;
  shippingTotal: string;
  grandTotal: string;
};

export type OrderStatusHistoryDto = {
  id: string;
  fromStatus?: string;
  toStatus: string;
  reason?: string;
  createdAt: string;
};

export type PaymentDto = {
  id: string;
  provider: string;
  method: string;
  amount: string;
  currency: string;
  status: string;
  providerPaymentId?: string;
};

export type OrderDto = {
  id: string;
  orderNumber: string;
  status: string;
  currency: string;
  email: string;
  phone?: string;
  placedAt: string;
  totals: OrderTotalsDto;
  items: OrderItemDto[];
  shippingAddress: ShippingAddressInput;
  statusHistory: OrderStatusHistoryDto[];
  payment?: PaymentDto;
};

export type OrderSummaryDto = {
  id: string;
  orderNumber: string;
  status: string;
  currency: string;
  subtotal: string;
  shippingTotal: string;
  grandTotal: string;
  itemCount: number;
  placedAt: string;
  updatedAt?: string;
  customerName?: string;
};

export type CheckoutSessionDto = {
  id: string;
  status: string;
  createdAt: string;
  expiresAt?: string;
};

export type PlaceOrderResult = {
  order: OrderDto;
  payment: PaymentDto;
  session: CheckoutSessionDto;
};

export type OrderListResult = {
  data: OrderSummaryDto[];
  meta: PaginationMeta;
};