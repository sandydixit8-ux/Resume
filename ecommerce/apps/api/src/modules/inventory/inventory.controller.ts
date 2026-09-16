import { Controller, Get, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";
import { VariantAvailabilityDto } from "@nexus/contracts";
import { Public } from "../../common/decorators/public.decorator";
import { InventoryService } from "./inventory.service";

class AvailabilityQuery {
  @IsOptional()
  @IsString()
  variantIds?: string;
}

@ApiTags("inventory")
@Controller("inventory")
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get("availability")
  @Public()
  @ApiOperation({ summary: "Aggregate available stock per variant across active warehouses" })
  availability(@Query() query: AvailabilityQuery): Promise<Record<string, VariantAvailabilityDto>> {
    const ids = (query.variantIds ?? "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    return this.inventoryService.availability(ids);
  }
}