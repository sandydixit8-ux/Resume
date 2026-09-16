import { Injectable } from "@nestjs/common";
import { PaymentMethod, Prisma } from "@prisma/client";
import {
  CheckoutSessionDto,
  OrderDto,
  PaymentDto,
  PlaceOrderRequest,
  PlaceOrderResult,
  ShippingAddressInput,
} from "@nexus/contracts";
import { PrismaService } from "../../prisma/prisma.service";
import { InventoryService } from "../inventory/inventory.service";
import { PricingService } from "../pricing/pricing.service";
import {
  NotFoundException,
  UnprocessableException,
  ValidationException,
} from "../../common/exceptions/app.exception";
import { D, ORDER_INCLUDE, OrdersService } from "./orders.service";

const FREE_SHIPPING_THRESHOLD = new D(499);
const SHIPPING_FEE = new D(49);
const EMPTY_ZERO = new D(0);

type CheckoutContext = {
  userId?: string;
  userEmail?: string;
  userPhone?: string;
};

@Injectable()
export class CheckoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ordersService: OrdersService,
    private readonly inventoryService: InventoryService,
    private readonly pricingService: PricingService,
  ) {}

  async placeOrder(input: PlaceOrderRequest, ctx: CheckoutContext): Promise<PlaceOrderResult> {
    const key = input.idempotencyKey?.trim();
    if (!key) throw ValidationException({ idempotencyKey: "idempotencyKey is required" });

    const existing = await this.prisma.order.findUnique({
      where: { idempotencyKey: key },
      include: ORDER_INCLUDE,
    });
    if (existing) return this.buildResult(existing);

    const email = ctx.userEmail ?? input.email?.trim();
    if (!email) throw ValidationException({ email: "email is required" });

    const cart = await this.resolveCart(input.cartToken, ctx.userId);
    if (!cart || cart.items.length === 0) throw UnprocessableException("Cart is empty");

    const promotions = await this.pricingService.listActivePromotions();

    let subtotal = new D(0);
    const resolvedByItem = new Map<string, ReturnType<typeof this.pricingService.priceLine>>();
    for (const item of cart.items) {
      const variant = item.variant;
      if (!variant || !variant.isActive) {
        throw UnprocessableException(`${variant?.name ?? "A variant"} is no longer available`);
      }
      if (variant.product.status !== "ACTIVE" || variant.product.deletedAt) {
        throw UnprocessableException(`${variant.product.name} is no longer available`);
      }
      const available = this.availableQuantity(variant.inventories);
      if (available === 0) throw UnprocessableException(`${variant.name} is out of stock`);
      if (item.quantity > available) {
        throw UnprocessableException(`Only ${available} units of ${variant.name} available`);
      }
      const resolved = this.pricingService.priceLine(
        {
          id: variant.id,
          productId: variant.productId,
          price: variant.price,
          mrp: variant.mrp,
          priceTiers: variant.priceTiers,
        },
        item.quantity,
        promotions,
      );
      resolvedByItem.set(item.id, resolved);
      subtotal = subtotal.plus(resolved.lineBase);
    }

    let discountTotal = new D(0);
    for (const resolved of resolvedByItem.values()) {
      discountTotal = discountTotal.plus(resolved.lineDiscount);
    }
    const taxTotal = new D(0);
    const shippingTotal = subtotal.gte(FREE_SHIPPING_THRESHOLD) ? EMPTY_ZERO : new D(SHIPPING_FEE);
    const grandTotal = subtotal.minus(discountTotal).plus(shippingTotal);

    const address = this.normalizeAddress(input.shippingAddress);
    const phone = ctx.userPhone ?? input.phone ?? address.phone;

    const now = new Date();
    const userId = ctx.userId ?? null;

    await this.prisma.$transaction(async (tx) => {
      const orderId = crypto.randomUUID();

      const order = await tx.order.create({
        data: {
          id: orderId,
          orderNumber: this.ordersService.newOrderNumber(),
          userId,
          email,
          phone,
          status: "CONFIRMED",
          currency: "INR",
          subtotal,
          discountTotal,
          taxTotal,
          shippingTotal,
          grandTotal,
          shippingAddress: address as object as Prisma.InputJsonValue,
          billingAddress: address as object as Prisma.InputJsonValue,
          idempotencyKey: key,
          placedAt: now,
        },
        include: ORDER_INCLUDE,
      });

      for (const item of cart.items) {
        const variant = item.variant;
        const resolved = resolvedByItem.get(item.id);
        if (!resolved) continue;
        const discount = variant.mrp.gt(resolved.unitPrice) ? variant.mrp.minus(resolved.unitPrice) : EMPTY_ZERO;
        await tx.orderItem.create({
          data: {
            orderId,
            productId: variant.productId,
            variantId: variant.id,
            name: `${variant.product.name} (${variant.name})`,
            sku: variant.sku,
            quantity: item.quantity,
            unitPrice: resolved.effectiveUnitPrice,
            mrp: variant.mrp,
            discount,
            promoDiscount: resolved.lineDiscount,
            promotionId: resolved.promotion?.id ?? null,
            promotionName: resolved.promotion?.name ?? null,
            promotionType: resolved.promotion?.type ?? null,
            tierMinQuantity: resolved.tierMinQuantity ?? null,
            taxRate: EMPTY_ZERO,
            taxAmount: EMPTY_ZERO,
            lineTotal: resolved.lineTotal,
            status: "CONFIRMED",
          },
        });
        await this.inventoryService.reserveInTransaction(
          tx,
          variant.id,
          item.quantity,
          "ORDER",
          orderId,
          userId ?? undefined,
        );
      }

      const payment = await tx.payment.create({
        data: {
          orderId,
          provider: "mock",
          method: input.paymentMethod as PaymentMethod,
          amount: grandTotal,
          currency: "INR",
          status: "CAPTURED",
          providerPaymentId: `pay_${crypto.randomUUID()}`,
          idempotencyKey: `${key}:pay`,
        },
      });

      await tx.checkoutSession.create({
        data: {
          cartId: cart.id,
          idempotencyKey: key,
          totals: {
            subtotal: subtotal.toFixed(2),
            discountTotal: discountTotal.toFixed(2),
            shippingTotal: shippingTotal.toFixed(2),
            grandTotal: grandTotal.toFixed(2),
            itemCount: cart.items.reduce((sum, item) => sum + item.quantity, 0),
          },
          status: "completed",
          expiresAt: now,
        },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: null,
          toStatus: "CONFIRMED",
          changedBy: userId,
          reason: "Payment captured",
        },
      });

      await tx.cart.update({
        where: { id: cart.id },
        data: { status: "CONVERTED", anonId: null },
      });
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

      return { order, payment };
    });

    const created = await this.prisma.order.findUnique({
      where: { idempotencyKey: key },
      include: ORDER_INCLUDE,
    });
    if (!created) throw NotFoundException("Order");
    return this.buildResult(created);
  }

  async findSession(sessionId: string): Promise<PlaceOrderResult> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      sessionId,
    );
    let session = isUuid
      ? await this.prisma.checkoutSession.findUnique({ where: { id: sessionId } })
      : null;
    if (!session) {
      session = await this.prisma.checkoutSession.findUnique({
        where: { idempotencyKey: sessionId },
      });
    }
    if (!session) throw NotFoundException("Checkout session");
    const order = await this.prisma.order.findUnique({
      where: { idempotencyKey: session.idempotencyKey },
      include: ORDER_INCLUDE,
    });
    if (!order) throw NotFoundException("Order");
    return this.buildResult(order);
  }

  private async resolveCart(token: string | undefined, userId?: string) {
    if (token?.trim()) {
      const cart = await this.loadCartByAddonId(token.trim());
      if (cart) return cart;
    }
    if (userId) {
      return this.prisma.cart.findFirst({
        where: { userId, status: "ACTIVE" },
        include: this.cartInclude(),
      });
    }
    return null;
  }

  private async loadCartByAddonId(token: string) {
    return this.prisma.cart.findFirst({
      where: { anonId: token, status: "ACTIVE" },
      include: this.cartInclude(),
    });
  }

  private cartInclude() {
    return {
      items: {
        include: {
          variant: {
            include: {
              product: true,
              inventories: { where: { warehouse: { isActive: true } } },
              priceTiers: { where: { isActive: true } },
            },
          },
        },
      },
    } satisfies Prisma.CartInclude;
  }

  private availableQuantity(inventories: { quantity: number; reservedQuantity: number }[]): number {
    return inventories.reduce((sum, inventory) => sum + inventory.quantity - inventory.reservedQuantity, 0);
  }

  private normalizeAddress(input: ShippingAddressInput): ShippingAddressInput {
    return {
      fullName: input.fullName.trim(),
      phone: input.phone.trim(),
      line1: input.line1.trim(),
      line2: input.line2?.trim(),
      city: input.city.trim(),
      state: input.state.trim(),
      pincode: input.pincode.trim(),
      country: input.country ?? "IN",
    };
  }

  private buildResult(order: Prisma.OrderGetPayload<{ include: typeof ORDER_INCLUDE }>): PlaceOrderResult {
    const orderDto: OrderDto = this.ordersService.toOrderDto(order);
    const payment: PaymentDto = {
      id: order.payments[0].id,
      provider: order.payments[0].provider,
      method: order.payments[0].method,
      amount: order.payments[0].amount.toString(),
      currency: order.payments[0].currency,
      status: order.payments[0].status,
      providerPaymentId: order.payments[0].providerPaymentId ?? undefined,
    };
    const sessionDto: CheckoutSessionDto = {
      id: order.idempotencyKey,
      status: "completed",
      createdAt: order.placedAt.toISOString(),
      expiresAt: order.placedAt.toISOString(),
    };
    return { order: orderDto, payment, session: sessionDto };
  }
}