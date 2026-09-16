import { Injectable } from "@nestjs/common";
import { Prisma, PromotionType } from "@prisma/client";
import {
  LineQuoteDto,
  PriceHistoryEntryDto,
  PriceTierDto,
  PriceTierInput,
  ProductPriceUpdateInput,
  PromotionDto,
  PromotionInput,
  PromotionScopeValue,
  PromotionTypeValue,
  QuoteDto,
  QuoteRequestItem,
  VariantPriceUpdateInput,
} from "@nexus/contracts";
import { PrismaService } from "../../prisma/prisma.service";
import { NotFoundException, ValidationException } from "../../common/exceptions/app.exception";

export const D = Prisma.Decimal;

export type VariantPricingSource = {
  id: string;
  productId: string;
  price: Prisma.Decimal;
  mrp: Prisma.Decimal;
  priceTiers?: { minQuantity: number; price: Prisma.Decimal; isActive: boolean }[];
};

export type PromotionJoin = Prisma.PromotionGetPayload<{ include: { items: true } }>;

export type ResolvedLine = {
  unitPrice: Prisma.Decimal;
  tierMinQuantity?: number;
  lineBase: Prisma.Decimal;
  lineDiscount: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
  effectiveUnitPrice: Prisma.Decimal;
  promotion?: {
    id: string;
    name: string;
    type: PromotionTypeValue;
    value: number;
    minQuantity: number;
  };
};

const round2 = (d: Prisma.Decimal): Prisma.Decimal => d.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

@Injectable()
export class PricingService {
  constructor(private readonly prisma: PrismaService) {}

  async listActivePromotions(now: Date = new Date()): Promise<PromotionJoin[]> {
    return this.prisma.promotion.findMany({
      where: { isActive: true, startAt: { lte: now }, endAt: { gte: now } },
      include: { items: true },
      orderBy: { priority: "desc" },
    });
  }

  resolveTierPrice(
    variant: VariantPricingSource,
    quantity: number,
  ): { unitPrice: Prisma.Decimal; tierMinQuantity?: number } {
    const tiers = (variant.priceTiers ?? [])
      .filter((t) => t.isActive && t.minQuantity >= 2)
      .sort((a, b) => b.minQuantity - a.minQuantity);
    const tier = tiers.find((t) => quantity >= t.minQuantity);
    if (tier) return { unitPrice: tier.price, tierMinQuantity: tier.minQuantity };
    return { unitPrice: variant.price };
  }

  resolvePromotion(
    promotions: PromotionJoin[],
    variant: VariantPricingSource,
    quantity: number,
  ): PromotionJoin | undefined {
    return promotions.find((p) => this.appliesTo(p, variant) && quantity >= this.promoMinQuantity(p));
  }

  priceLine(
    variant: VariantPricingSource,
    quantity: number,
    promotions: PromotionJoin[],
  ): ResolvedLine {
    const { unitPrice, tierMinQuantity } = this.resolveTierPrice(variant, quantity);
    const lineBase = unitPrice.mul(quantity);
    const promo = this.resolvePromotion(promotions, variant, quantity);

    let lineDiscount = new D(0);
    let promotion: ResolvedLine["promotion"];
    if (promo && promo.config) {
      const config = promo.config as { value?: number; minQuantity?: number };
      const value = Number(config.value ?? 0);
      let raw = new D(0);
      if (promo.type === PromotionType.PERCENTAGE_OFF) raw = lineBase.mul(value).div(100);
      else raw = new D(String(value));
      if (raw.gt(lineBase)) raw = lineBase;
      if (raw.lt(0)) raw = new D(0);
      lineDiscount = round2(raw);
      promotion = {
        id: promo.id,
        name: promo.name,
        type: promo.type as PromotionTypeValue,
        value,
        minQuantity: this.promoMinQuantity(promo),
      };
    }

    const lineTotal = lineBase.minus(lineDiscount);
    const effectiveUnitPrice = round2(lineTotal.div(quantity));
    return { unitPrice, tierMinQuantity, lineBase, lineDiscount, lineTotal, effectiveUnitPrice, promotion };
  }

  async quote(items: QuoteRequestItem[], now: Date = new Date()): Promise<QuoteDto> {
    if (!items || items.length === 0) throw ValidationException({ items: "at least one item is required" });
    for (const item of items) {
      if (!item.variantId) throw ValidationException({ items: "each quote item must include variantId" });
      if (!item.quantity || item.quantity < 1) throw ValidationException({ items: "each quote item quantity must be at least 1" });
    }

    const promotions = await this.listActivePromotions(now);
    const variants = await this.prisma.productVariant.findMany({
      where: { id: { in: [...new Set(items.map((i) => i.variantId))] } },
      include: {
        product: true,
        priceTiers: { where: { isActive: true } },
      },
    });
    const variantMap = new Map(variants.map((v) => [v.id, v]));

    let subtotal = new D(0);
    let discount = new D(0);
    let savings = new D(0);
    const lines: LineQuoteDto[] = [];

    for (const item of items) {
      const variant = variantMap.get(item.variantId);
      if (!variant || !variant.isActive || variant.product.status !== "ACTIVE" || variant.product.deletedAt) {
        throw NotFoundException("Variant");
      }
      const resolved = this.priceLine(variant, item.quantity, promotions);
      lines.push({
        variantId: variant.id,
        productId: variant.productId,
        sku: variant.sku,
        variantName: variant.name,
        productName: variant.product.name,
        quantity: item.quantity,
        mrp: variant.mrp.toString(),
        basePrice: variant.price.toString(),
        unitPrice: resolved.effectiveUnitPrice.toString(),
        tierMinQuantity: resolved.tierMinQuantity,
        promotionId: resolved.promotion?.id,
        promotionName: resolved.promotion?.name,
        promotionType: resolved.promotion?.type,
        promoDiscount: resolved.lineDiscount.toString(),
        lineTotal: resolved.lineTotal.toString(),
      });
      subtotal = subtotal.plus(resolved.lineTotal);
      discount = discount.plus(resolved.lineDiscount);
      savings = savings.plus(variant.mrp.sub(resolved.effectiveUnitPrice).mul(item.quantity));
    }

    return {
      items: lines,
      subtotal: subtotal.toFixed(2),
      discount: discount.toFixed(2),
      savings: savings.toFixed(2),
    };
  }

  async listTiers(variantId: string): Promise<PriceTierDto[]> {
    const variant = await this.prisma.productVariant.findUnique({ where: { id: variantId } });
    if (!variant) throw NotFoundException("Variant");
    const tiers = await this.prisma.priceTier.findMany({
      where: { productVariantId: variantId },
      orderBy: { minQuantity: "asc" },
    });
    return tiers.map((t) => this.toTier(t));
  }

  async upsertTier(variantId: string, input: PriceTierInput): Promise<PriceTierDto> {
    const variant = await this.prisma.productVariant.findUnique({ where: { id: variantId } });
    if (!variant) throw NotFoundException("Variant");
    if (!Number.isInteger(input.minQuantity) || input.minQuantity < 2) {
      throw ValidationException({ minQuantity: "minQuantity must be an integer of at least 2" });
    }
    if (!Number.isFinite(input.price) || input.price <= 0) {
      throw ValidationException({ price: "price must be positive" });
    }
    if (input.price > Number(variant.mrp)) {
      throw ValidationException({ price: "tier price must not exceed mrp" });
    }
    if (input.price >= Number(variant.price)) {
      throw ValidationException({ price: "tier price must be lower than the base price" });
    }
    const tier = await this.prisma.priceTier.upsert({
      where: { productVariantId_minQuantity: { productVariantId: variantId, minQuantity: input.minQuantity } },
      update: { price: new D(String(input.price)), isActive: true },
      create: { productVariantId: variantId, minQuantity: input.minQuantity, price: new D(String(input.price)) },
    });
    return this.toTier(tier);
  }

  async deleteTier(variantId: string, tierId: string): Promise<void> {
    const tier = await this.prisma.priceTier.findFirst({ where: { id: tierId, productVariantId: variantId } });
    if (!tier) throw NotFoundException("Price tier");
    await this.prisma.priceTier.delete({ where: { id: tierId } });
  }

  async listPromotions(): Promise<PromotionDto[]> {
    const promotions = await this.prisma.promotion.findMany({
      include: { items: { include: { product: { select: { id: true, name: true } }, productVariant: { select: { id: true, sku: true, name: true } } } } },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    });
    return promotions.map((p) => this.toPromotion(p));
  }

  async createPromotion(input: PromotionInput): Promise<PromotionDto> {
    await this.validatePromotion(input);
    const createdAt = new Date();
    const promotion = await this.prisma.$transaction(async (tx) => {
      const created = await tx.promotion.create({
        data: {
          name: input.name.trim(),
          type: input.type as PromotionType,
          scope: input.scope ?? "ALL",
          config: { value: input.value, minQuantity: input.minQuantity ?? 1 },
          startAt: new Date(input.startAt),
          endAt: new Date(input.endAt),
          priority: input.priority ?? 0,
          isActive: input.isActive ?? true,
        },
      });
      if (input.scope !== "ALL" && input.scope !== undefined) {
        const items =
          input.scope === "PRODUCT"
            ? (input.products ?? []).map((productId) => ({ promotionId: created.id, productId }))
            : (input.variants ?? []).map((productVariantId) => ({ promotionId: created.id, productVariantId }));
        await tx.promotionItem.createMany({ data: items });
      }
      return created;
    });
    return this.getPromotionOrThrow(promotion.id);
  }

  async updatePromotion(id: string, input: PromotionInput): Promise<PromotionDto> {
    await this.validatePromotion(input);
    const existing = await this.prisma.promotion.findUnique({ where: { id } });
    if (!existing) throw NotFoundException("Promotion");
    await this.prisma.$transaction(async (tx) => {
      await tx.promotion.update({
        where: { id },
        data: {
          name: input.name.trim(),
          type: input.type as PromotionType,
          scope: input.scope ?? "ALL",
          config: { value: input.value, minQuantity: input.minQuantity ?? 1 },
          startAt: new Date(input.startAt),
          endAt: new Date(input.endAt),
          priority: input.priority ?? 0,
          isActive: input.isActive ?? true,
        },
      });
      await tx.promotionItem.deleteMany({ where: { promotionId: id } });
      if (input.scope !== "ALL" && input.scope !== undefined) {
        const items =
          input.scope === "PRODUCT"
            ? (input.products ?? []).map((productId) => ({ promotionId: id, productId }))
            : (input.variants ?? []).map((productVariantId) => ({ promotionId: id, productVariantId }));
        await tx.promotionItem.createMany({ data: items });
      }
    });
    return this.getPromotionOrThrow(id);
  }

  async deletePromotion(id: string): Promise<void> {
    const promotion = await this.prisma.promotion.findUnique({ where: { id } });
    if (!promotion) throw NotFoundException("Promotion");
    await this.prisma.promotion.delete({ where: { id } });
  }

  private async getPromotionOrThrow(id: string): Promise<PromotionDto> {
    const promotion = await this.prisma.promotion.findUnique({
      where: { id },
      include: { items: { include: { product: { select: { id: true, name: true } }, productVariant: { select: { id: true, sku: true, name: true } } } } },
    });
    if (!promotion) throw NotFoundException("Promotion");
    return this.toPromotion(promotion);
  }

  private async validatePromotion(input: PromotionInput): Promise<void> {
    const errors: Record<string, string> = {};
    if (!input.name?.trim()) errors.name = "name is required";
    if (input.type !== "PERCENTAGE_OFF" && input.type !== "FLAT_OFF") {
      errors.type = "type must be PERCENTAGE_OFF or FLAT_OFF";
    }
    const value = typeof input.value === "number" ? input.value : Number(input.value);
    if (!Number.isFinite(value) || value <= 0) {
      errors.value = "value must be positive";
    } else if (input.type === "PERCENTAGE_OFF" && value > 100) {
      errors.value = "percentage value must not exceed 100";
    }
    if (input.minQuantity !== undefined && (!Number.isInteger(input.minQuantity) || input.minQuantity < 1)) {
      errors.minQuantity = "minQuantity must be a positive integer";
    }
    const start = new Date(input.startAt);
    const end = new Date(input.endAt);
    if (Number.isNaN(start.getTime())) errors.startAt = "startAt must be a valid date";
    if (Number.isNaN(end.getTime())) errors.endAt = "endAt must be a valid date";
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && start >= end) {
      errors.endAt = "endAt must be after startAt";
    }
    if (input.priority !== undefined && (!Number.isInteger(input.priority) || input.priority < 0)) {
      errors.priority = "priority must be a non-negative integer";
    }
    if (Object.keys(errors).length > 0) throw ValidationException(errors);

    const scope: PromotionScopeValue = input.scope ?? "ALL";
    if (scope === "PRODUCT") {
      const ids = input.products ?? [];
      if (ids.length === 0) throw ValidationException({ products: "at least one product is required for PRODUCT scope" });
      const count = await this.prisma.product.count({ where: { id: { in: ids } } });
      if (count !== ids.length) throw ValidationException({ products: "one or more product ids are invalid" });
    }
    if (scope === "VARIANT") {
      const ids = input.variants ?? [];
      if (ids.length === 0) throw ValidationException({ variants: "at least one variant is required for VARIANT scope" });
      const count = await this.prisma.productVariant.count({ where: { id: { in: ids } } });
      if (count !== ids.length) throw ValidationException({ variants: "one or more variant ids are invalid" });
    }
  }

  private appliesTo(p: PromotionJoin, variant: VariantPricingSource): boolean {
    if (p.scope === "ALL") return true;
    if (p.scope === "PRODUCT") return p.items.some((i) => i.productId === variant.productId);
    if (p.scope === "VARIANT") return p.items.some((i) => i.productVariantId === variant.id);
    return false;
  }

  private promoMinQuantity(p: PromotionJoin): number {
    const config = p.config as { minQuantity?: number } | null;
    return Math.max(1, Math.floor(Number(config?.minQuantity ?? 1)));
  }

  private toTier(t: {
    id: string;
    productVariantId: string;
    minQuantity: number;
    price: Prisma.Decimal;
    isActive: boolean;
    createdAt: Date;
  }): PriceTierDto {
    return {
      id: t.id,
      productVariantId: t.productVariantId,
      minQuantity: t.minQuantity,
      price: t.price.toString(),
      isActive: t.isActive,
      createdAt: t.createdAt.toISOString(),
    };
  }

  private toPromotion(p: {
    id: string;
    name: string;
    type: PromotionType;
    scope: string;
    config: Prisma.JsonValue;
    startAt: Date;
    endAt: Date;
    priority: number;
    isActive: boolean;
    createdAt: Date;
    items: {
      id: string;
      productId: string | null;
      productVariantId: string | null;
      product?: { id: string; name: string } | null;
      productVariant?: { id: string; sku: string; name: string } | null;
    }[];
  }): PromotionDto {
    const now = new Date();
    const config = p.config as { value?: number; minQuantity?: number } | null;
    const status: PromotionDto["status"] = !p.isActive
      ? "PAUSED"
      : now < p.startAt
        ? "UPCOMING"
        : now > p.endAt
          ? "ENDED"
          : "RUNNING";
    return {
      id: p.id,
      name: p.name,
      type: p.type as PromotionTypeValue,
      scope: p.scope as PromotionScopeValue,
      value: Number(config?.value ?? 0),
      minQuantity: Number(config?.minQuantity ?? 1),
      startAt: p.startAt.toISOString(),
      endAt: p.endAt.toISOString(),
      priority: p.priority,
      active: p.isActive,
      status,
      products: p.items.filter((i) => i.productId).map((i) => ({ id: i.productId!, name: i.product?.name ?? "" })),
      variants: p.items.filter((i) => i.productVariantId).map((i) => ({ id: i.productVariantId!, sku: i.productVariant?.sku ?? "", name: i.productVariant?.name ?? "" })),
      createdAt: p.createdAt.toISOString(),
    };
  }

  async updateProductPrice(
    productId: string,
    input: ProductPriceUpdateInput,
    actorId: string | undefined,
  ): Promise<{ mrp: string; sellingPrice: string; history: PriceHistoryEntryDto[] }> {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw NotFoundException("Product");
    this.validatePrice(input.sellingPrice, input.mrp);

    const changes: { fieldName: string; fromValue: Prisma.Decimal; toValue: Prisma.Decimal }[] = [];
    if (input.mrp !== undefined && input.mrp !== Number(product.mrp)) {
      changes.push({ fieldName: "mrp", fromValue: product.mrp, toValue: new Prisma.Decimal(String(input.mrp)) });
    }
    if (input.sellingPrice !== undefined && input.sellingPrice !== Number(product.sellingPrice)) {
      changes.push({
        fieldName: "sellingPrice",
        fromValue: product.sellingPrice,
        toValue: new Prisma.Decimal(String(input.sellingPrice)),
      });
    }

    if (changes.length > 0) {
      await this.prisma.$transaction(async (tx) => {
        const data: Prisma.ProductUpdateInput = {};
        for (const change of changes) {
          if (change.fieldName === "mrp") data.mrp = change.toValue;
          if (change.fieldName === "sellingPrice") data.sellingPrice = change.toValue;
        }
        await tx.product.update({ where: { id: productId }, data });
        for (const change of changes) {
          await tx.priceHistory.create({
            data: {
              productId,
              fieldName: change.fieldName,
              fromValue: change.fromValue,
              toValue: change.toValue,
              reason: input.reason?.trim(),
              actorId,
            },
          });
        }
      });
    }

    const updated = await this.prisma.product.findUnique({ where: { id: productId } });
    const history = await this.prisma.priceHistory.findMany({
      where: { productId },
      orderBy: { createdAt: "desc" },
      take: 25,
    });
    return {
      mrp: updated!.mrp.toString(),
      sellingPrice: updated!.sellingPrice.toString(),
      history: history.map((h) => this.toEntry(h)),
    };
  }

  async updateVariantPrice(
    variantId: string,
    input: VariantPriceUpdateInput,
    actorId: string | undefined,
  ): Promise<{ price: string; mrp: string; history: PriceHistoryEntryDto[] }> {
    const variant = await this.prisma.productVariant.findUnique({ where: { id: variantId } });
    if (!variant) throw NotFoundException("Variant");
    this.validatePrice(input.price, input.mrp);

    const changes: { fieldName: string; fromValue: Prisma.Decimal; toValue: Prisma.Decimal }[] = [];
    if (input.price !== undefined && input.price !== Number(variant.price)) {
      changes.push({ fieldName: "price", fromValue: variant.price, toValue: new Prisma.Decimal(String(input.price)) });
    }
    if (input.mrp !== undefined && input.mrp !== Number(variant.mrp)) {
      changes.push({ fieldName: "mrp", fromValue: variant.mrp, toValue: new Prisma.Decimal(String(input.mrp)) });
    }

    if (changes.length > 0) {
      await this.prisma.$transaction(async (tx) => {
        const data: Prisma.ProductVariantUpdateInput = {};
        for (const change of changes) {
          if (change.fieldName === "price") data.price = change.toValue;
          if (change.fieldName === "mrp") data.mrp = change.toValue;
        }
        await tx.productVariant.update({ where: { id: variantId }, data });
        for (const change of changes) {
          await tx.priceHistory.create({
            data: {
              productVariantId: variantId,
              fieldName: change.fieldName,
              fromValue: change.fromValue,
              toValue: change.toValue,
              reason: input.reason?.trim(),
              actorId,
            },
          });
        }
      });
    }

    const updated = await this.prisma.productVariant.findUnique({ where: { id: variantId } });
    const history = await this.prisma.priceHistory.findMany({
      where: { productVariantId: variantId },
      orderBy: { createdAt: "desc" },
      take: 25,
    });
    return {
      price: updated!.price.toString(),
      mrp: updated!.mrp.toString(),
      history: history.map((h) => this.toEntry(h)),
    };
  }

  private validatePrice(sellingPrice?: number, mrp?: number): void {
    for (const [name, value] of Object.entries({ sellingPrice, mrp })) {
      if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
        throw ValidationException({ [name]: "must be a non-negative number" });
      }
    }
    if (sellingPrice !== undefined && mrp !== undefined && sellingPrice > mrp) {
      throw ValidationException({ sellingPrice: "selling price must not exceed mrp" });
    }
  }

  private toEntry(h: {
    id: string;
    fieldName: string;
    fromValue: Prisma.Decimal;
    toValue: Prisma.Decimal;
    reason: string | null;
    createdAt: Date;
  }): PriceHistoryEntryDto {
    return {
      id: h.id,
      fieldName: h.fieldName,
      fromValue: h.fromValue.toString(),
      toValue: h.toValue.toString(),
      reason: h.reason ?? undefined,
      createdAt: h.createdAt.toISOString(),
    };
  }
}