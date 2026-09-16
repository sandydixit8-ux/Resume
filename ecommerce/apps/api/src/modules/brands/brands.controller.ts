import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { BrandDto } from "@nexus/contracts";
import { RequirePermissions } from "../../common/decorators/rbac.decorator";
import { Public } from "../../common/decorators/public.decorator";
import { BrandsService, BrandCreateInput } from "./brands.service";

class BrandDtoInput implements BrandCreateInput {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  slug?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  description?: string;

  @IsOptional()
  @IsString()
  seoTitle?: string;

  @IsOptional()
  @IsString()
  seoDescription?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

@ApiTags("catalog")
@Public()
@Controller("brands")
export class BrandsController {
  constructor(private readonly brandsService: BrandsService) {}

  @Get()
  @ApiOperation({ summary: "List active brands" })
  list(): Promise<BrandDto[]> {
    return this.brandsService.list(false);
  }
}

@ApiTags("admin-catalog")
@ApiBearerAuth()
@Controller("admin/brands")
export class BrandsAdminController {
  constructor(private readonly brandsService: BrandsService) {}

  @Get()
  @RequirePermissions("brand.view")
  @ApiOperation({ summary: "List brands (incl. inactive)" })
  list(): Promise<BrandDto[]> {
    return this.brandsService.list(true);
  }

  @Post()
  @RequirePermissions("brand.create")
  @ApiOperation({ summary: "Create a brand" })
  create(@Body() dto: BrandDtoInput): Promise<BrandDto> {
    return this.brandsService.create(dto);
  }

  @Patch(":id")
  @RequirePermissions("brand.edit")
  @ApiOperation({ summary: "Update a brand" })
  update(@Param("id") id: string, @Body() dto: Partial<BrandDtoInput>): Promise<BrandDto> {
    return this.brandsService.update(id, dto);
  }

  @Delete(":id")
  @RequirePermissions("brand.delete")
  @HttpCode(204)
  @ApiOperation({ summary: "Soft-delete a brand" })
  remove(@Param("id") id: string): Promise<void> {
    return this.brandsService.remove(id);
  }
}