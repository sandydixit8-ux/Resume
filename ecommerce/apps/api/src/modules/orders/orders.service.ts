import { Injectable } from "@nestjs/common";
import { OrderStatus, Prisma } from "@prisma/client";
import {
  OrderDto,
  OrderItemDto,
  OrderListResult,
  OrderStatusHistoryDto,
  OrderStatusValue,
  OrderSummaryDto,
  PaginationMeta,
  PaymentDto,
  ShippingAddressInput,
} from "@nexus/contracts";
import { PrismaService } from "../../prisma/prisma.service";
import { InventoryService } from "../inventory/inventory.service";
import {
  NotFoundException,
  UnauthorizedException,
  UnprocessableException,
  ValidationException,
} from "../../common/exceptions/app.exception";

const D = Prisma.Decimal;

export const ORDER_INCLUDE = {
  items: {
    include: {
      variant: true,
      product: {
        include: { images: { where: { isPrimary: true }, take: 1 } },
      },
    },
  },
  statusHistory: { orderBy: { createdAt: "asc" as const } },
  payments: { orderBy: { createdAt: "asc" as const } },
} satisfies Prisma.OrderInclude;

type OrderWithRelations = Prisma.OrderGetPayload<{ include: typeof ORDER_INCLUDE }>;

const SUMMARY_SELECT = {
  id: true,
  orderNumber: true,
  status: true,
  currency: true,
  subtotal: true,
  shippingTotal: true,
  grandTotal: true,
  placedAt: true,
  updatedAt: true,
  user: { select: { name: true } },
  _count: { select: { items: true } },
} satisfies Prisma.OrderSelect;

type OrderSummaryRow = Prisma.OrderGetPayload<{ select: typeof SUMMARY_SELECT }>;

const TRANSITIONS: Record<string, OrderStatusValue[]> = {
  PLACED: ["CONFIRMED", "CANCELLED"],
  PAYMENT_PENDING: ["CONFIRMED", "CANCELLED", "PAYMENT_FAILED"],
  CONFIRMED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["PACKED", "CANCELLED"],
  PACKED: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["OUT_FOR_DELIVERY", "CANCELLED"],
  OUT_FOR_DELIVERY: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
  PAYMENT_FAILED: ["CONFIRMED", "CANCELLED"],
  RETURN_REQUESTED: ["RETURN_APPROVED"],
  RETURN_APPROVED: ["PICKUP_SCHEDULED"],
  PICKUP_SCHEDULED: ["RETURNED"],
  RETURNED: ["REFUND_PENDING"],
  REFUND_PENDING: ["REFUNDED"],
  REFUNDED: [],
};

const CUSTOMER_CANCELLABLE: OrderStatusValue[] = ["PLACED", "PAYMENT_PENDING", "CONFIRMED"];

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
  ) {}

  async listMine(
    userId: string,
    page: number,
    pageSize: number,
    status?: string,
  ): Promise<OrderListResult> {
    const where: Prisma.OrderWhereInput = { userId, ...(status ? { status: status as OrderStatus } : {}) };
    const [rows, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        select: SUMMARY_SELECT,
        orderBy: { placedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.order.count({ where }),
    ]);
    return { data: rows.map((row) => this.toSummary(row)), meta: this.buildMeta(page, pageSize, total) };
  }

  async findMine(userId: string, orderId: string): Promise<OrderDto> {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: ORDER_INCLUDE,
    });
    if (!order) throw NotFoundException("Order");
    return this.toOrderDto(order);
  }

  async cancelMine(userId: string, orderId: string, reason?: string): Promise<OrderDto> {
    const order = await this.prisma.order.findFirst({ where: { id: orderId, userId } });
    if (!order) throw NotFoundException("Order");

    if (!CUSTOMER_CANCELLABLE.includes(order.status as OrderStatusValue)) {
      throw UnprocessableException(`Order cannot be cancelled in status ${order.status}`);
    }

    const updated = await this.updateStatusInternal(
      order.id,
      order.status,
      "CANCELLED",
      userId,
      reason ?? "Cancelled by customer",
    );
    return this.toOrderDto(updated);
  }

  async adminList(
    page: number,
    pageSize: number,
    status?: string,
  ): Promise<OrderListResult> {
    const where: Prisma.OrderWhereInput = status ? { status: status as OrderStatus } : {};
    const [rows, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        select: SUMMARY_SELECT,
        orderBy: { placedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.order.count({ where }),
    ]);
    return { data: rows.map((row) => this.toSummary(row)), meta: this.buildMeta(page, pageSize, total) };
  }

  async adminGet(orderId: string): Promise<OrderDto> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: ORDER_INCLUDE });
    if (!order) throw NotFoundException("Order");
    return this.toOrderDto(order);
  }

  async adminUpdateStatus(
    orderId: string,
    toStatus: string,
    actorId: string,
    reason?: string,
  ): Promise<OrderDto> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw NotFoundException("Order");
    const allowed = TRANSITIONS[order.status] ?? [];
    if (!allowed.includes(toStatus as OrderStatusValue)) {
      throw UnprocessableException(`Illegal transition ${order.status} -> ${toStatus}`);
    }
    const updated = await this.updateStatusInternal(
      order.id,
      order.status,
      toStatus,
      actorId,
      reason,
    );
    return this.toOrderDto(updated);
  }

  newOrderNumber(): string {
    const t = Date.now().toString(36).toUpperCase();
    const r = crypto.randomUUID().slice(0, 6).toUpperCase();
    return `NX-${t}-${r}`;
  }

  private async updateStatusInternal(
    orderId: string,
    fromStatus: string,
    toStatus: string,
    changedBy: string | null,
    reason?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id: orderId },
        data: {
          status: toStatus as OrderStatus,
          ...(toStatus === "CANCELLED" ? { cancelledAt: new Date() } : {}),
        },
        include: ORDER_INCLUDE,
      });

      if (toStatus === "CANCELLED") {
        await this.inventoryService.releaseOrderReservations(tx, orderId, changedBy ?? undefined);
      }

      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus,
          toStatus,
          changedBy,
          reason,
        },
      });

      return updated;
    });
  }

  private toSummary(row: OrderSummaryRow): OrderSummaryDto {
    return {
      id: row.id,
      orderNumber: row.orderNumber,
      status: row.status,
      currency: row.currency,
      subtotal: row.subtotal.toString(),
      shippingTotal: row.shippingTotal.toString(),
      grandTotal: row.grandTotal.toString(),
      itemCount: row._count.items,
      placedAt: row.placedAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      customerName: row.user?.name ?? undefined,
    };
  }

  toOrderDto(order: OrderWithRelations): OrderDto {
    const items: OrderItemDto[] = order.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      variantId: item.variantId,
      name: item.name,
      variantName: item.variant?.name ?? undefined,
      sku: item.sku,
      imageUrl: item.product.images?.[0]?.url,
      quantity: item.quantity,
      unitPrice: item.unitPrice.toString(),
      mrp: item.mrp.toString(),
      discount: item.discount.toString(),
      promoDiscount: item.promoDiscount.toString(),
      promotionId: item.promotionId ?? undefined,
      promotionName: item.promotionName ?? undefined,
      promotionType: item.promotionType ?? undefined,
      tierMinQuantity: item.tierMinQuantity ?? undefined,
      taxRate: item.taxRate.toString(),
      taxAmount: item.taxAmount.toString(),
      lineTotal: item.lineTotal.toString(),
      status: item.status,
    }));

    const history: OrderStatusHistoryDto[] = order.statusHistory.map((entry) => ({
      id: entry.id,
      fromStatus: entry.fromStatus ?? undefined,
      toStatus: entry.toStatus,
      reason: entry.reason ?? undefined,
      createdAt: entry.createdAt.toISOString(),
    }));

    const payment: PaymentDto | undefined = order.payments[0]
      ? {
          id: order.payments[0].id,
          provider: order.payments[0].provider,
          method: order.payments[0].method,
          amount: order.payments[0].amount.toString(),
          currency: order.payments[0].currency,
          status: order.payments[0].status,
          providerPaymentId: order.payments[0].providerPaymentId ?? undefined,
        }
      : undefined;

    const address = order.shippingAddress as unknown as ShippingAddressInput;

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      currency: order.currency,
      email: order.email,
      phone: order.phone ?? undefined,
      placedAt: order.placedAt.toISOString(),
      totals: {
        subtotal: order.subtotal.toString(),
        discountTotal: order.discountTotal.toString(),
        taxTotal: order.taxTotal.toString(),
        shippingTotal: order.shippingTotal.toString(),
        grandTotal: order.grandTotal.toString(),
      },
      items,
      shippingAddress: address,
      statusHistory: history,
      payment,
    };
  }

  private buildMeta(page: number, pageSize: number, total: number): PaginationMeta {
    return { page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
  }
}

export { D };

export function requireUserId(userId: string | undefined): string {
  if (!userId) throw UnauthorizedException("Authentication required");
  return userId;
}

export function validateEmail(email: string | undefined): string {
  if (!email) throw ValidationException({ email: "email is required for guest checkout" });
  return email;
}