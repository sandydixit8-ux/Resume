import { Injectable } from "@nestjs/common";
import { InventoryMovementType, InventoryTransferStatus, Prisma } from "@prisma/client";
import {
  InventoryCreateTransferInput,
  InventoryMovementTypeValue,
  InventoryRowDto,
  InventoryTransferDto,
  InventoryTransferStatusValue,
  ReorderRowDto,
  VariantAvailabilityDto,
  WarehouseCreateInput,
  WarehouseDto,
} from "@nexus/contracts";
import { PrismaService } from "../../prisma/prisma.service";
import {
  NotFoundException,
  UnprocessableException,
  ValidationException,
  ConflictException,
} from "../../common/exceptions/app.exception";

export type StockAdjustInput = {
  warehouseId: string;
  variantId: string;
  quantityDelta: number;
  type: InventoryMovementTypeValue;
  reason?: string;
};

const INVENTORY_ROW_INCLUDE = {
  warehouse: { select: { code: true, name: true } },
  variant: { include: { product: { select: { name: true } } } },
} satisfies Prisma.InventoryInclude;

const TRANSFER_INCLUDE = {
  sourceWarehouse: { select: { id: true, code: true, name: true } },
  destinationWarehouse: { select: { id: true, code: true, name: true } },
  createdBy: { select: { name: true } },
  items: {
    include: { variant: { include: { product: { select: { name: true } } } } },
    orderBy: { id: "asc" as const },
  },
} satisfies Prisma.InventoryTransferInclude;

type InventoryJoin = Prisma.InventoryGetPayload<{ include: typeof INVENTORY_ROW_INCLUDE }>;
type TransferJoin = Prisma.InventoryTransferGetPayload<{ include: typeof TRANSFER_INCLUDE }>;

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async listWarehouses(): Promise<WarehouseDto[]> {
    const rows = await this.prisma.warehouse.findMany({
      orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
    });
    return rows.map((w) => ({
      id: w.id,
      name: w.name,
      code: w.code,
      city: w.city ?? undefined,
      state: w.state ?? undefined,
      isActive: w.isActive,
      priority: w.priority,
    }));
  }

  async createWarehouse(input: WarehouseCreateInput): Promise<WarehouseDto> {
    if (!input.name?.trim()) throw ValidationException({ name: "name is required" });
    if (!input.code?.trim()) throw ValidationException({ code: "code is required" });
    const existing = await this.prisma.warehouse.findUnique({ where: { code: input.code.trim() } });
    if (existing) throw ConflictException(`Warehouse code "${input.code}" already exists`);

    const created = await this.prisma.warehouse.create({
      data: {
        name: input.name.trim(),
        code: input.code.trim().toUpperCase(),
        line1: input.line1?.trim(),
        city: input.city?.trim(),
        state: input.state?.trim(),
        pincode: input.pincode?.trim(),
        priority: input.priority ?? 0,
        isActive: input.isActive ?? true,
      },
    });
    return {
      id: created.id,
      name: created.name,
      code: created.code,
      city: created.city ?? undefined,
      state: created.state ?? undefined,
      isActive: created.isActive,
      priority: created.priority,
    };
  }

  async adjustStock(input: StockAdjustInput, actorId?: string): Promise<InventoryRowDto> {
    if (!input.warehouseId) throw ValidationException({ warehouseId: "warehouseId is required" });
    if (!input.variantId) throw ValidationException({ variantId: "variantId is required" });
    if (!input.quantityDelta || input.quantityDelta === 0) {
      throw ValidationException({ quantityDelta: "quantityDelta must be non-zero" });
    }
    if (!this.isAdjustType(input.type)) throw ValidationException({ type: `unsupported movement type ${input.type}` });

    const warehouse = await this.prisma.warehouse.findUnique({ where: { id: input.warehouseId } });
    if (!warehouse) throw NotFoundException("Warehouse");
    if (!warehouse.isActive) throw UnprocessableException("Warehouse is inactive");

    const variant = await this.prisma.productVariant.findUnique({ where: { id: input.variantId } });
    if (!variant) throw NotFoundException("Variant");

    const inventory = await this.prisma.inventory.upsert({
      where: { warehouseId_productVariantId: { warehouseId: input.warehouseId, productVariantId: input.variantId } },
      update: {},
      create: { warehouseId: input.warehouseId, productVariantId: input.variantId, quantity: 0 },
    });

    const delta = this.applyDelta(input.type, input.quantityDelta);
    const nextQuantity = inventory.quantity + delta;
    if (nextQuantity < 0) {
      throw UnprocessableException(
        `Adjustment would leave negative stock (${inventory.quantity} + ${delta.toFixed(0)})`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.inventory.update({
        where: { id: inventory.id },
        data: {
          quantity: nextQuantity,
          ...(input.type === "DAMAGE"
            ? { damagedQuantity: { increment: Math.abs(input.quantityDelta) } }
            : {}),
        },
      });
      await tx.inventoryMovement.create({
        data: {
          inventoryId: inventory.id,
          type: input.type as InventoryMovementType,
          quantityDelta: input.quantityDelta,
          reason: input.reason,
          referenceType: "MANUAL",
          actorId,
        },
      });
    });

    const joined = await this.prisma.inventory.findUnique({
      where: { id: inventory.id },
      include: INVENTORY_ROW_INCLUDE,
    });
    if (!joined) throw NotFoundException("Inventory");
    return this.toRow(joined);
  }

  async updateReorderConfig(
    id: string,
    input: { reorderPoint?: number; reorderQuantity?: number },
  ): Promise<InventoryRowDto> {
    const existing = await this.prisma.inventory.findUnique({ where: { id } });
    if (!existing) throw NotFoundException("Inventory");
    const data: Prisma.InventoryUpdateInput = {};
    if (input.reorderPoint !== undefined) data.reorderPoint = Math.max(0, Math.floor(input.reorderPoint));
    if (input.reorderQuantity !== undefined) data.reorderQuantity = Math.max(0, Math.floor(input.reorderQuantity));
    const updated = await this.prisma.inventory.update({ where: { id }, data, include: INVENTORY_ROW_INCLUDE });
    return this.toRow(updated);
  }

  async createTransfer(
    input: InventoryCreateTransferInput,
    actorId?: string,
  ): Promise<InventoryTransferDto> {
    if (!input.sourceWarehouseId) throw ValidationException({ sourceWarehouseId: "sourceWarehouseId is required" });
    if (!input.destinationWarehouseId) {
      throw ValidationException({ destinationWarehouseId: "destinationWarehouseId is required" });
    }
    if (input.sourceWarehouseId === input.destinationWarehouseId) {
      throw UnprocessableException("Source and destination warehouses must be different");
    }
    if (!input.items || input.items.length === 0) {
      throw ValidationException({ items: "at least one item is required" });
    }
    for (const item of input.items) {
      if (!item.variantId) throw ValidationException({ items: "each item must include variantId" });
      if (!item.quantity || item.quantity <= 0) {
        throw ValidationException({ items: "each item quantity must be positive" });
      }
    }

    const [source, destination] = await Promise.all([
      this.prisma.warehouse.findUnique({ where: { id: input.sourceWarehouseId } }),
      this.prisma.warehouse.findUnique({ where: { id: input.destinationWarehouseId } }),
    ]);
    if (!source) throw NotFoundException("Source warehouse");
    if (!destination) throw NotFoundException("Destination warehouse");
    if (!source.isActive) throw UnprocessableException("Source warehouse is inactive");
    if (!destination.isActive) throw UnprocessableException("Destination warehouse is inactive");

    const referenceNumber = this.referenceNumber();
    const transfer = await this.prisma.$transaction(async (tx) => {
      const created = await tx.inventoryTransfer.create({
        data: {
          referenceNumber,
          sourceWarehouseId: source.id,
          destinationWarehouseId: destination.id,
          note: input.note,
          createdById: actorId,
        },
      });

      for (const item of input.items) {
        const inv = await tx.inventory.findUnique({
          where: {
            warehouseId_productVariantId: { warehouseId: source.id, productVariantId: item.variantId },
          },
        });
        const available = inv ? inv.quantity - inv.reservedQuantity : 0;
        if (!inv || available < item.quantity) {
          throw UnprocessableException(
            `Only ${available} units available for this variant at ${source.code}`,
          );
        }

        await tx.inventory.update({
          where: { id: inv.id },
          data: { quantity: inv.quantity - item.quantity },
        });

        const destinationInventory = await tx.inventory.upsert({
          where: {
            warehouseId_productVariantId: {
              warehouseId: destination.id,
              productVariantId: item.variantId,
            },
          },
          update: { quantity: { increment: item.quantity } },
          create: {
            warehouseId: destination.id,
            productVariantId: item.variantId,
            quantity: item.quantity,
          },
        });

        await tx.inventoryMovement.create({
          data: {
            inventoryId: inv.id,
            type: "TRANSFER",
            quantityDelta: -item.quantity,
            reason: input.note,
            referenceType: "TRANSFER",
            referenceId: created.id,
            actorId,
          },
        });
        await tx.inventoryMovement.create({
          data: {
            inventoryId: destinationInventory.id,
            type: "TRANSFER",
            quantityDelta: item.quantity,
            reason: input.note,
            referenceType: "TRANSFER",
            referenceId: created.id,
            actorId,
          },
        });
        await tx.inventoryTransferItem.create({
          data: {
            transferId: created.id,
            productVariantId: item.variantId,
            sourceInventoryId: inv.id,
            destinationInventoryId: destinationInventory.id,
            quantity: item.quantity,
          },
        });
      }

      return tx.inventoryTransfer.update({
        where: { id: created.id },
        data: { status: InventoryTransferStatus.COMPLETED, completedAt: new Date() },
        include: TRANSFER_INCLUDE,
      });
    });

    return this.toTransfer(transfer);
  }

  async listTransfers(query: {
    page?: number;
    pageSize?: number;
    status?: InventoryTransferStatusValue;
    sourceWarehouseId?: string;
    destinationWarehouseId?: string;
  }): Promise<{
    data: InventoryTransferDto[];
    meta: { page: number; pageSize: number; total: number; totalPages: number };
  }> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.InventoryTransferWhereInput = {
      ...(query.status ? { status: query.status as InventoryTransferStatus } : {}),
      ...(query.sourceWarehouseId ? { sourceWarehouseId: query.sourceWarehouseId } : {}),
      ...(query.destinationWarehouseId ? { destinationWarehouseId: query.destinationWarehouseId } : {}),
    };

    const total = await this.prisma.inventoryTransfer.count({ where });
    const rows = await this.prisma.inventoryTransfer.findMany({
      where,
      include: TRANSFER_INCLUDE,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return {
      data: rows.map((r) => this.toTransfer(r)),
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  async getTransfer(id: string): Promise<InventoryTransferDto> {
    const row = await this.prisma.inventoryTransfer.findUnique({
      where: { id },
      include: TRANSFER_INCLUDE,
    });
    if (!row) throw NotFoundException("Transfer");
    return this.toTransfer(row);
  }

  async reorderReport(): Promise<ReorderRowDto[]> {
    const rows = await this.prisma.inventory.findMany({
      where: {
        OR: [{ reorderPoint: { gt: 0 } }, { reorderQuantity: { gt: 0 } }],
        warehouse: { isActive: true },
      },
      include: INVENTORY_ROW_INCLUDE,
    });

    type ReportRow = {
      productVariantId: string;
      sku: string;
      variantName: string;
      productName: string;
      available: number;
      reserved: number;
      reorderPoint: number;
      suggestedQuantity: number;
    };
    const byVariant = new Map<string, ReportRow>();
    for (const row of rows) {
      const current =
        byVariant.get(row.productVariantId) ??
        ({
          productVariantId: row.productVariantId,
          sku: row.variant.sku,
          variantName: row.variant.name,
          productName: row.variant.product.name,
          available: 0,
          reserved: 0,
          reorderPoint: 0,
          suggestedQuantity: 0,
        } satisfies ReportRow);
      current.available += row.quantity - row.reservedQuantity;
      current.reserved += row.reservedQuantity;
      current.reorderPoint += row.reorderPoint;
      current.suggestedQuantity += row.reorderQuantity;
      byVariant.set(row.productVariantId, current);
    }

    const report = [...byVariant.values()].filter(
      (row) => row.reorderPoint > 0 && row.available <= row.reorderPoint,
    );
    report.sort(
      (a, b) =>
        a.available / Math.max(1, a.reorderPoint) - b.available / Math.max(1, b.reorderPoint),
    );
    return report;
  }

  async listInventory(query: {
    page?: number;
    pageSize?: number;
    warehouseId?: string;
    q?: string;
    lowStockOnly?: boolean;
  }): Promise<{ data: InventoryRowDto[]; meta: { page: number; pageSize: number; total: number; totalPages: number } }> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.InventoryWhereInput = {
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
      ...(query.q
        ? {
            OR: [
              { variant: { sku: { contains: query.q, mode: "insensitive" } } },
              { variant: { name: { contains: query.q, mode: "insensitive" } } },
              { variant: { product: { name: { contains: query.q, mode: "insensitive" } } } },
            ],
          }
        : {}),
    };

    const rows = await this.prisma.inventory.findMany({
      where,
      include: INVENTORY_ROW_INCLUDE,
      orderBy: [{ updatedAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    let items = rows.map((r) => this.toRow(r));
    let total = await this.prisma.inventory.count({ where });

    if (query.lowStockOnly) {
      const all = await this.prisma.inventory.findMany({
        where,
        include: INVENTORY_ROW_INCLUDE,
      });
      const low = all.filter((r) => r.quantity - r.reservedQuantity <= r.lowStockThreshold && r.quantity > 0);
      total = low.length;
      items = low.slice((page - 1) * pageSize, page * pageSize).map((r) => this.toRow(r));
    }

    return {
      data: items,
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  async availability(variantIds: string[]): Promise<Record<string, VariantAvailabilityDto>> {
    if (variantIds.length === 0) return {};
    const rows = await this.prisma.inventory.findMany({
      where: {
        productVariantId: { in: variantIds },
        warehouse: { isActive: true },
      },
      select: { productVariantId: true, quantity: true, reservedQuantity: true, lowStockThreshold: true },
    });
    const out: Record<string, VariantAvailabilityDto> = {};
    for (const id of variantIds) {
      let available = 0;
      let reserved = 0;
      let lowStockThreshold = 0;
      for (const row of rows) {
        if (row.productVariantId !== id) continue;
        available += row.quantity - row.reservedQuantity;
        reserved += row.reservedQuantity;
        lowStockThreshold = Math.max(lowStockThreshold, row.lowStockThreshold);
      }
      out[id] = {
        variantId: id,
        available,
        reserved,
        inStock: available > 0,
        lowStock: available > 0 && available <= lowStockThreshold,
      };
    }
    return out;
  }

  async reserveInTransaction(
    tx: Prisma.TransactionClient,
    variantId: string,
    quantity: number,
    referenceType: string,
    referenceId: string,
    actorId?: string,
  ): Promise<void> {
    const rows = await tx.inventory.findMany({
      where: { productVariantId: variantId, warehouse: { isActive: true } },
      orderBy: { warehouse: { priority: "asc" } },
    });
    let remaining = quantity;
    for (const row of rows) {
      const free = row.quantity - row.reservedQuantity;
      if (free <= 0) continue;
      const take = Math.min(remaining, free);
      await tx.inventory.update({
        where: { id: row.id },
        data: { reservedQuantity: { increment: take } },
      });
      await tx.inventoryMovement.create({
        data: {
          inventoryId: row.id,
          type: "RESERVE",
          quantityDelta: take,
          referenceType,
          referenceId,
          actorId,
        },
      });
      remaining -= take;
      if (remaining === 0) break;
    }
    if (remaining > 0) {
      throw UnprocessableException(`Only ${quantity - remaining} units available for this variant`);
    }
  }

  async releaseOrderReservations(
    tx: Prisma.TransactionClient,
    orderId: string,
    actorId?: string,
  ): Promise<void> {
    const reservations = await tx.inventoryMovement.findMany({
      where: { referenceType: "ORDER", referenceId: orderId, type: "RESERVE" },
    });
    for (const movement of reservations) {
      await tx.inventory.update({
        where: { id: movement.inventoryId },
        data: { reservedQuantity: { decrement: movement.quantityDelta } },
      });
      await tx.inventoryMovement.create({
        data: {
          inventoryId: movement.inventoryId,
          type: "RELEASE",
          quantityDelta: movement.quantityDelta,
          referenceType: "ORDER",
          referenceId: orderId,
          actorId,
        },
      });
    }
  }

  private applyDelta(type: InventoryMovementTypeValue, delta: number): number {
    switch (type) {
      case "PURCHASE":
        return Math.abs(delta);
      case "RETURN":
        return Math.abs(delta);
      case "ADJUSTMENT":
        return delta;
      case "DAMAGE":
        return -Math.abs(delta);
      default:
        return 0;
    }
  }

  private isAdjustType(type: InventoryMovementTypeValue): boolean {
    return ["PURCHASE", "ADJUSTMENT", "DAMAGE", "RETURN"].includes(type);
  }

  private toRow(r: InventoryJoin): InventoryRowDto {
    const available = r.quantity - r.reservedQuantity;
    return {
      id: r.id,
      warehouseId: r.warehouseId,
      warehouseCode: r.warehouse.code,
      productVariantId: r.productVariantId,
      sku: r.variant.sku,
      variantName: r.variant.name,
      productName: r.variant.product.name,
      quantity: r.quantity,
      reservedQuantity: r.reservedQuantity,
      damagedQuantity: r.damagedQuantity,
      lowStockThreshold: r.lowStockThreshold,
      reorderPoint: r.reorderPoint,
      reorderQuantity: r.reorderQuantity,
      reorderNeeded: r.reorderPoint > 0 && available <= r.reorderPoint,
      updatedAt: r.updatedAt.toISOString(),
    };
  }

  private toTransfer(t: TransferJoin): InventoryTransferDto {
    return {
      id: t.id,
      referenceNumber: t.referenceNumber,
      sourceWarehouseId: t.sourceWarehouse.id,
      sourceWarehouseCode: t.sourceWarehouse.code,
      sourceWarehouseName: t.sourceWarehouse.name,
      destinationWarehouseId: t.destinationWarehouse.id,
      destinationWarehouseCode: t.destinationWarehouse.code,
      destinationWarehouseName: t.destinationWarehouse.name,
      status: t.status,
      note: t.note ?? undefined,
      createdById: t.createdById ?? undefined,
      createdByName: t.createdBy?.name,
      createdAt: t.createdAt.toISOString(),
      completedAt: t.completedAt?.toISOString(),
      items: t.items.map((item) => ({
        id: item.id,
        productVariantId: item.productVariantId,
        sku: item.variant.sku,
        variantName: item.variant.name,
        productName: item.variant.product.name,
        quantity: item.quantity,
      })),
    };
  }

  private referenceNumber(): string {
    const stamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `TFR-${stamp}${random}`;
  }
}