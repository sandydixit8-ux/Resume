import { Body, Controller, Get, Param, Post, Query, Patch } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import {
  InventoryMovementTypeValues,
  InventoryRowDto,
  InventoryTransferStatusValues,
} from "@nexus/contracts";
import { CurrentUser as CurrentUserType } from "@nexus/contracts";
import { RequirePermissions } from "../../common/decorators/rbac.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { InventoryService } from "./inventory.service";

class AdminListInventoryQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;

  @IsOptional()
  @IsString()
  warehouseId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @Type(() => Boolean)
  lowStockOnly?: boolean;
}

class AdjustStockDto {
  @IsString()
  warehouseId!: string;

  @IsString()
  variantId!: string;

  @IsNumber()
  quantityDelta!: number;

  @IsIn(InventoryMovementTypeValues)
  type!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

class UpdateReorderConfigDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  reorderPoint?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  reorderQuantity?: number;
}

class TransferItemDto {
  @IsString()
  variantId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;
}

class CreateTransferDto {
  @IsString()
  sourceWarehouseId!: string;

  @IsString()
  destinationWarehouseId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TransferItemDto)
  items!: TransferItemDto[];

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}

class AdminListTransfersQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;

  @IsOptional()
  @IsIn(InventoryTransferStatusValues)
  status?: string;

  @IsOptional()
  @IsString()
  sourceWarehouseId?: string;

  @IsOptional()
  @IsString()
  destinationWarehouseId?: string;
}

class CreateWarehouseDto {
  @IsString()
  @MaxLength(80)
  name!: string;

  @IsString()
  @MaxLength(20)
  code!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  line1?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  state?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  pincode?: string;

  @IsOptional()
  @IsInt()
  priority?: number;

  @IsOptional()
  @Type(() => Boolean)
  isActive?: boolean;
}

@ApiTags("admin-inventory")
@ApiBearerAuth()
@Controller("admin")
export class InventoryAdminController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get("warehouses")
  @RequirePermissions("warehouse.view")
  @ApiOperation({ summary: "List warehouses" })
  warehouses() {
    return this.inventoryService.listWarehouses();
  }

  @Post("warehouses")
  @RequirePermissions("warehouse.create")
  @ApiOperation({ summary: "Create a warehouse" })
  createWarehouse(@Body() dto: CreateWarehouseDto) {
    return this.inventoryService.createWarehouse(dto);
  }

  @Get("inventory")
  @RequirePermissions("inventory.view")
  @ApiOperation({ summary: "List inventory rows (page/filter)" })
  inventory(@Query() query: AdminListInventoryQuery) {
    return this.inventoryService.listInventory({
      page: query.page,
      pageSize: query.pageSize,
      warehouseId: query.warehouseId,
      q: query.q,
      lowStockOnly: query.lowStockOnly,
    });
  }

  @Patch("inventory/adjust")
  @RequirePermissions("inventory.adjust")
  @ApiOperation({ summary: "Adjust stock level for a variant at a warehouse" })
  adjust(@Body() dto: AdjustStockDto, @CurrentUser() user: CurrentUserType): Promise<InventoryRowDto> {
    return this.inventoryService.adjustStock(
      {
        warehouseId: dto.warehouseId,
        variantId: dto.variantId,
        quantityDelta: dto.quantityDelta,
        type: dto.type as never,
        reason: dto.reason,
      },
      user.id,
    );
  }

  @Patch("inventory/:id/reorder")
  @RequirePermissions("inventory.adjust")
  @ApiOperation({ summary: "Set reorder point / reorder quantity for an inventory row" })
  updateReorderConfig(
    @Param("id") id: string,
    @Body() dto: UpdateReorderConfigDto,
  ): Promise<InventoryRowDto> {
    return this.inventoryService.updateReorderConfig(id, dto);
  }

  @Get("inventory/reorder-report")
  @RequirePermissions("inventory.view")
  @ApiOperation({ summary: "Reorder report: variants at or below reorder point" })
  reorderReport() {
    return this.inventoryService.reorderReport();
  }

  @Post("inventory/transfers")
  @RequirePermissions("inventory.transfer")
  @ApiOperation({ summary: "Transfer stock between warehouses" })
  createTransfer(@Body() dto: CreateTransferDto, @CurrentUser() user: CurrentUserType) {
    return this.inventoryService.createTransfer(
      {
        sourceWarehouseId: dto.sourceWarehouseId,
        destinationWarehouseId: dto.destinationWarehouseId,
        items: dto.items.map((item) => ({ variantId: item.variantId, quantity: item.quantity })),
        note: dto.note,
      },
      user.id,
    );
  }

  @Get("inventory/transfers")
  @RequirePermissions("inventory.transfer")
  @ApiOperation({ summary: "List stock transfers (page/filter)" })
  listTransfers(@Query() query: AdminListTransfersQuery) {
    return this.inventoryService.listTransfers({
      page: query.page,
      pageSize: query.pageSize,
      status: query.status as never,
      sourceWarehouseId: query.sourceWarehouseId,
      destinationWarehouseId: query.destinationWarehouseId,
    });
  }

  @Get("inventory/transfers/:id")
  @RequirePermissions("inventory.transfer")
  @ApiOperation({ summary: "Get a stock transfer by id" })
  getTransfer(@Param("id") id: string) {
    return this.inventoryService.getTransfer(id);
  }
}