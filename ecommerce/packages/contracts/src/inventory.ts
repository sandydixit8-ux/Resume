export type WarehouseDto = {
  id: string;
  name: string;
  code: string;
  city?: string;
  state?: string;
  isActive: boolean;
  priority: number;
};

export type WarehouseCreateInput = {
  name: string;
  code: string;
  line1?: string;
  city?: string;
  state?: string;
  pincode?: string;
  priority?: number;
  isActive?: boolean;
};

export type InventoryAdjustInput = {
  warehouseId: string;
  variantId: string;
  quantityDelta: number;
  type: "PURCHASE" | "ADJUSTMENT" | "DAMAGE" | "RETURN";
  reason?: string;
};

export type InventoryRowDto = {
  id: string;
  warehouseId: string;
  warehouseCode: string;
  productVariantId: string;
  sku: string;
  variantName: string;
  productName: string;
  quantity: number;
  reservedQuantity: number;
  damagedQuantity: number;
  lowStockThreshold: number;
  reorderPoint: number;
  reorderQuantity: number;
  reorderNeeded: boolean;
  updatedAt: string;
};

export type VariantAvailabilityDto = {
  variantId: string;
  available: number;
  reserved: number;
  inStock: boolean;
  lowStock: boolean;
};

export const InventoryMovementTypeValues = [
  "PURCHASE",
  "SALE",
  "RESERVE",
  "RELEASE",
  "ADJUSTMENT",
  "DAMAGE",
  "RETURN",
  "TRANSFER",
] as const;

export type InventoryMovementTypeValue = (typeof InventoryMovementTypeValues)[number];

export const InventoryTransferStatusValues = ["IN_TRANSIT", "COMPLETED", "CANCELLED"] as const;
export type InventoryTransferStatusValue = (typeof InventoryTransferStatusValues)[number];

export type InventoryTransferItemDto = {
  id: string;
  productVariantId: string;
  sku: string;
  variantName: string;
  productName: string;
  quantity: number;
};

export type InventoryTransferDto = {
  id: string;
  referenceNumber: string;
  sourceWarehouseId: string;
  sourceWarehouseCode: string;
  sourceWarehouseName: string;
  destinationWarehouseId: string;
  destinationWarehouseCode: string;
  destinationWarehouseName: string;
  status: InventoryTransferStatusValue;
  note?: string;
  createdById?: string;
  createdByName?: string;
  createdAt: string;
  completedAt?: string;
  items: InventoryTransferItemDto[];
};

export type InventoryCreateTransferInput = {
  sourceWarehouseId: string;
  destinationWarehouseId: string;
  items: { variantId: string; quantity: number }[];
  note?: string;
};

export type ReorderRowDto = {
  productVariantId: string;
  sku: string;
  variantName: string;
  productName: string;
  available: number;
  reserved: number;
  reorderPoint: number;
  suggestedQuantity: number;
};