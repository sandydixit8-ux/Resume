import { Injectable } from "@nestjs/common";
import { CartDto, CartItemDto, CartTotalsDto } from "@nexus/contracts";
import { PrismaService } from "../../prisma/prisma.service";
import { D, PricingService } from "../pricing/pricing.service";
import {
  NotFoundException,
  UnprocessableException,
  ValidationException,
} from "../../common/exceptions/app.exception";

export type CartAddInput = {
  variantId: string;
  quantity: number;
};

@Injectable()
export class CartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricingService: PricingService,
  ) {}

  async getCart(token: string | undefined): Promise<CartDto> {
    if (!token) return this.emptyDto();
    const cart = await this.prisma.cart.findFirst({
      where: { anonId: token, status: "ACTIVE" },
      include: {
        items: {
          include: {
variant: {
                  include: {
                    product: {
                      include: { images: { where: { isPrimary: true }, take: 1 } },
                    },
                    inventories: { where: { warehouse: { isActive: true } } },
                    priceTiers: { where: { isActive: true } },
                  },
                },
          },
        },
      },
    });
    if (!cart || cart.items.length === 0) return this.emptyDto(token);
    return await this.toDto(cart, token);
  }

  async addItem(
    token: string | undefined,
    input: CartAddInput,
  ): Promise<{ cart: CartDto; token: string }> {
    if (!input.variantId) throw ValidationException({ variantId: "variantId is required" });
    if (!input.quantity || input.quantity < 1) throw ValidationException({ quantity: "quantity must be at least 1" });

    const variant = await this.prisma.productVariant.findUnique({
      where: { id: input.variantId },
      include: {
        product: {
          include: { images: { where: { isPrimary: true }, take: 1 } },
        },
        inventories: { where: { warehouse: { isActive: true } } },
      },
    });
    if (!variant || !variant.isActive) throw NotFoundException("Variant");
    if (variant.product.deletedAt || variant.product.status !== "ACTIVE") throw NotFoundException("Product");

    const availableStock = this.availableQuantity(variant.inventories);
    if (availableStock === 0) throw UnprocessableException(`Out of stock`);

    const cart = await this.findOrCreateCart(token);
    const newToken = cart.anonId!;

    const existing = cart.items.find((i) => i.productVariantId === input.variantId);

    const newQty = existing ? existing.quantity + input.quantity : input.quantity;
    if (newQty > availableStock) {
      throw UnprocessableException(`Only ${availableStock} units available`);
    }

    if (existing) {
      await this.prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: newQty, unitPriceSnapshot: variant.price },
      });
    } else {
      await this.prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productVariantId: input.variantId,
          quantity: newQty,
          unitPriceSnapshot: variant.price,
        },
      });
    }

    const refreshed = await this.requireCart(cart.id);
    return { cart: await this.toDto(refreshed, newToken), token: newToken };
  }

  async updateItemQuantity(
    token: string | undefined,
    itemId: string,
    quantity: number,
  ): Promise<CartDto> {
    if (quantity < 1) throw ValidationException({ quantity: "quantity must be at least 1" });
    const cart = await this.findCartByToken(token);
    const item = cart.items.find((i) => i.id === itemId);
    if (!item) throw NotFoundException("Cart item");

    const availableStock = this.availableQuantity(item.variant.inventories);
    if (availableStock === 0) throw UnprocessableException(`Out of stock`);
    if (quantity > availableStock) {
      throw UnprocessableException(`Only ${availableStock} units available`);
    }

    await this.prisma.cartItem.update({
      where: { id: itemId },
      data: { quantity, unitPriceSnapshot: item.variant.price },
    });

    const refreshed = await this.requireCart(cart.id);
    return await this.toDto(refreshed, cart.anonId!);
  }

  async removeItem(token: string | undefined, itemId: string): Promise<CartDto> {
    const cart = await this.findCartByToken(token);
    const item = cart.items.find((i) => i.id === itemId);
    if (!item) throw NotFoundException("Cart item");

    await this.prisma.cartItem.delete({ where: { id: itemId } });
    const refreshed = await this.requireCart(cart.id);
    return await this.toDto(refreshed, cart.anonId!);
  }

  async clear(token: string | undefined): Promise<CartDto> {
    const cart = await this.findCartByToken(token);
    await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    const refreshed = await this.requireCart(cart.id);
    return await this.toDto(refreshed, cart.anonId!);
  }

  async mergeAnonymousToUser(anonToken: string, userId: string): Promise<CartDto> {
    const anonCart = await this.prisma.cart.findFirst({
      where: { anonId: anonToken, status: "ACTIVE" },
      include: { items: true },
    });
    if (!anonCart || anonCart.items.length === 0) {
      let userCart = await this.prisma.cart.findFirst({
        where: { userId, status: "ACTIVE" },
        include: { items: true },
      });
      if (!userCart) {
        userCart = await this.prisma.cart.create({
          data: { userId, status: "ACTIVE", currency: "INR" },
          include: { items: true },
        });
      }
      const result = await this.requireCart(userCart.id);
      return await this.toDto(result, undefined);
    }

    let userCart = await this.prisma.cart.findFirst({
      where: { userId, status: "ACTIVE" },
      include: { items: true },
    });
    if (!userCart) {
      userCart = await this.prisma.cart.create({
        data: { userId, status: "ACTIVE", currency: "INR" },
        include: { items: true },
      });
    }

    for (const anonItem of anonCart.items) {
      const existing = userCart.items?.find(
        (i) => i.productVariantId === anonItem.productVariantId,
      );
      if (existing) {
        await this.prisma.cartItem.update({
          where: { id: existing.id },
          data: { quantity: existing.quantity + anonItem.quantity },
        });
      } else {
        await this.prisma.cartItem.create({
          data: {
            cartId: userCart.id,
            productVariantId: anonItem.productVariantId,
            quantity: anonItem.quantity,
            unitPriceSnapshot: anonItem.unitPriceSnapshot,
          },
        });
      }
    }

    await this.prisma.cart.update({
      where: { id: anonCart.id },
      data: { status: "CONVERTED", anonId: null },
    });
    await this.prisma.cartItem.deleteMany({ where: { cartId: anonCart.id } });

    const result = await this.requireCart(userCart.id);
    return await this.toDto(result, undefined);
  }

  private async requireCart(cartId: string) {
    const cart = await this.loadCart(cartId);
    if (!cart) throw NotFoundException("Cart");
    return cart;
  }

  private availableQuantity(inventories: { quantity: number; reservedQuantity: number }[]): number {
    return inventories.reduce((sum, i) => sum + i.quantity - i.reservedQuantity, 0);
  }

  private async findOrCreateCart(token: string | undefined) {
    let cart = token
      ? await this.prisma.cart.findFirst({
          where: { anonId: token, status: "ACTIVE" },
          include: { items: true },
        })
      : null;

    if (!cart) {
      const newToken = token || crypto.randomUUID();
      cart = await this.prisma.cart.create({
        data: {
          anonId: newToken,
          status: "ACTIVE",
          currency: "INR",
        },
        include: { items: true },
      });
    }
    return cart;
  }

  private async findCartByToken(token: string | undefined) {
    if (!token) throw NotFoundException("Cart");
    const cart = await this.prisma.cart.findFirst({
      where: { anonId: token, status: "ACTIVE" },
      include: {
        items: {
          include: {
variant: {
                  include: {
                    product: {
                      include: { images: { where: { isPrimary: true }, take: 1 } },
                    },
                    inventories: { where: { warehouse: { isActive: true } } },
                    priceTiers: { where: { isActive: true } },
                  },
                },
          },
        },
      },
    });
    if (!cart) throw NotFoundException("Cart");
    return cart;
  }

  private async loadCart(cartId: string) {
    return this.prisma.cart.findUnique({
      where: { id: cartId },
      include: {
        items: {
          include: {
variant: {
                  include: {
                    product: {
                      include: { images: { where: { isPrimary: true }, take: 1 } },
                    },
                    inventories: { where: { warehouse: { isActive: true } } },
                    priceTiers: { where: { isActive: true } },
                  },
                },
          },
        },
      },
    });
  }

  private async toDto(
    cart: NonNullable<Awaited<ReturnType<typeof this.loadCart>>>,
    token?: string | null,
  ): Promise<CartDto> {
    const promotions = await this.pricingService.listActivePromotions();
    const items: CartItemDto[] = cart.items.map((i) => {
      const img = i.variant.product.images?.[0];
      const currentPrice = i.variant.price;
      const mrp = i.variant.mrp;
      const resolved = this.pricingService.priceLine(
        {
          id: i.variant.id,
          productId: i.variant.productId,
          price: i.variant.price,
          mrp,
          priceTiers: i.variant.priceTiers,
        },
        i.quantity,
        promotions,
      );
      return {
        id: i.id,
        variantId: i.productVariantId,
        productId: i.variant.productId,
        productName: i.variant.product.name,
        variantName: i.variant.name,
        sku: i.variant.sku,
        imageUrl: img?.url,
        unitPrice: i.unitPriceSnapshot.toString(),
        basePrice: currentPrice.toString(),
        effectiveUnitPrice: resolved.effectiveUnitPrice.toString(),
        mrp: mrp.toString(),
        quantity: i.quantity,
        lineTotal: resolved.lineTotal.toString(),
        promoDiscount: resolved.lineDiscount.toString(),
        priceChanged: i.unitPriceSnapshot.toString() !== currentPrice.toString(),
        inStock: this.availableQuantity(i.variant.inventories) >= i.quantity,
        tierMinQuantity: resolved.tierMinQuantity,
        promotionId: resolved.promotion?.id,
        promotionName: resolved.promotion?.name,
        promotionType: resolved.promotion?.type,
      };
    });

    const subtotal = items.reduce((sum, i) => sum.plus(i.lineTotal), new D(0));
    const discount = items.reduce((sum, i) => sum.plus(i.promoDiscount), new D(0));
    const savings = items.reduce((sum, i) => sum.plus(new D(i.mrp).minus(i.effectiveUnitPrice).times(i.quantity)), new D(0));
    const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

    const totals: CartTotalsDto = {
      subtotal: subtotal.toFixed(2),
      itemCount,
      savings: savings.toFixed(2),
      discount: discount.toFixed(2),
    };

    return {
      id: cart.id,
      token: token ?? undefined,
      items,
      totals,
      updatedAt: cart.updatedAt.toISOString(),
    };
  }

  private emptyDto(token?: string): CartDto {
    return {
      id: "",
      token,
      items: [],
      totals: { subtotal: "0.00", itemCount: 0, savings: "0.00", discount: "0.00" },
      updatedAt: new Date().toISOString(),
    };
  }
}