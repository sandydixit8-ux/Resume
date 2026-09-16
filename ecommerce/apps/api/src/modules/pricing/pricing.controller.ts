import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { CurrentUser as CurrentUserType } from "@nexus/contracts";
import { PromotionScopeValues, PromotionTypeValues } from "@nexus/contracts";
import { RequirePermissions } from "../../common/decorators/rbac.decorator";
import { Public } from "../../common/decorators/public.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { PricingService } from "./pricing.service";

class ProductPriceDto {
  @IsOptional()
  @IsNumber()
  mrp?: number;

  @IsOptional()
  @IsNumber()
  sellingPrice?: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

class VariantPriceDto {
  @IsOptional()
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsNumber()
  mrp?: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

class TierDto {
  @IsInt()
  @Min(2)
  minQuantity!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  price!: number;
}

class PromotionDto {
  @IsString()
  @MaxLength(200)
  name!: string;

  @IsIn(PromotionTypeValues)
  type!: (typeof PromotionTypeValues)[number];

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  value!: number;

  @IsOptional()
  @IsIn(PromotionScopeValues)
  scope?: (typeof PromotionScopeValues)[number];

  @IsOptional()
  @IsInt()
  @Min(1)
  minQuantity?: number;

  @IsISO8601()
  startAt!: string;

  @IsISO8601()
  endAt!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @IsUUID("4", { each: true })
  products?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID("4", { each: true })
  variants?: string[];
}

class QuoteItemDto {
  @IsUUID()
  variantId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

class QuoteQueryDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuoteItemDto)
  items!: QuoteItemDto[];
}

@ApiTags("admin-pricing")
@ApiBearerAuth()
@Controller("admin")
export class PricingController {
  constructor(private readonly pricingService: PricingService) {}

  @Patch("products/:id/price")
  @RequirePermissions("price.update")
  @ApiOperation({ summary: "Update product mrp/sellingPrice and record price history" })
  productPrice(
    @Param("id") id: string,
    @Body() dto: ProductPriceDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.pricingService.updateProductPrice(id, dto, user.id);
  }

  @Patch("variants/:id/price")
  @RequirePermissions("price.update")
  @ApiOperation({ summary: "Update variant price/mrp and record price history" })
  variantPrice(
    @Param("id") id: string,
    @Body() dto: VariantPriceDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.pricingService.updateVariantPrice(id, dto, user.id);
  }

  @Get("variants/:id/tiers")
  @RequirePermissions("price.view")
  @ApiOperation({ summary: "List quantity price tiers for a variant" })
  listTiers(@Param("id") id: string) {
    return this.pricingService.listTiers(id);
  }

  @Post("variants/:id/tiers")
  @RequirePermissions("price.tiers")
  @ApiOperation({ summary: "Create or update a quantity price tier for a variant" })
  upsertTier(@Param("id") id: string, @Body() dto: TierDto) {
    return this.pricingService.upsertTier(id, dto);
  }

  @Delete("variants/:id/tiers/:tierId")
  @HttpCode(204)
  @RequirePermissions("price.tiers")
  @ApiOperation({ summary: "Delete a price tier for a variant" })
  async deleteTier(@Param("id") id: string, @Param("tierId") tierId: string) {
    await this.pricingService.deleteTier(id, tierId);
  }

  @Get("promotions")
  @RequirePermissions("price.view")
  @ApiOperation({ summary: "List promotions" })
  listPromotions() {
    return this.pricingService.listPromotions();
  }

  @Post("promotions")
  @RequirePermissions("price.promotions")
  @ApiOperation({ summary: "Create a promotion" })
  createPromotion(@Body() dto: PromotionDto) {
    return this.pricingService.createPromotion(dto);
  }

  @Patch("promotions/:id")
  @RequirePermissions("price.promotions")
  @ApiOperation({ summary: "Update a promotion" })
  updatePromotion(@Param("id") id: string, @Body() dto: PromotionDto) {
    return this.pricingService.updatePromotion(id, dto);
  }

  @Delete("promotions/:id")
  @HttpCode(204)
  @RequirePermissions("price.promotions")
  @ApiOperation({ summary: "Delete a promotion" })
  async deletePromotion(@Param("id") id: string) {
    await this.pricingService.deletePromotion(id);
  }
}

@ApiTags("pricing")
@Public()
@Controller("pricing")
export class QuoteController {
  constructor(private readonly pricingService: PricingService) {}

  @Get("quote")
  @ApiOperation({ summary: "Public price quote for tiered pricing and promotions" })
  quote(@Query() query: QuoteQueryDto) {
    return this.pricingService.quote(query.items);
  }
}