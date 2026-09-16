import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsArray, IsBoolean, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength, ValidateNested } from "class-validator";
import { CollectionDetail, CollectionDto, ProductSummary, PaginationMeta } from "@nexus/contracts";
import { RequirePermissions } from "../../common/decorators/rbac.decorator";
import { Public } from "../../common/decorators/public.decorator";
import { CollectionsService, CollectionCreateInput } from "./collections.service";

class CollectionInput implements CollectionCreateInput {
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
  @MaxLength(30)
  type?: string;

  @IsOptional()
  rules?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  seoTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  seoDescription?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @IsUUID("4", { each: true })
  productIds?: string[];
}

class SetProductsInput {
  @IsArray()
  @IsUUID("4", { each: true })
  productIds!: string[];
}

class CollectionProductsQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize: number = 12;
}

type CollectionProductsResult = CollectionDetail & {
  products: ProductSummary[];
  meta: PaginationMeta;
};

@ApiTags("catalog")
@Public()
@Controller("collections")
export class CollectionsController {
  constructor(private readonly collectionsService: CollectionsService) {}

  @Get()
  @ApiOperation({ summary: "List active collections" })
  list(): Promise<CollectionDto[]> {
    return this.collectionsService.list(false);
  }

  @Get(":slug")
  @ApiOperation({ summary: "Collection detail with products" })
  detail(@Param("slug") slug: string, @Query() query: CollectionProductsQuery): Promise<CollectionProductsResult> {
    return this.collectionsService.detail(slug, query.page, query.pageSize);
  }
}

@ApiTags("admin-catalog")
@ApiBearerAuth()
@Controller("admin/collections")
export class CollectionsAdminController {
  constructor(private readonly collectionsService: CollectionsService) {}

  @Get()
  @RequirePermissions("collection.view")
  @ApiOperation({ summary: "List collections (incl. inactive)" })
  list(): Promise<CollectionDto[]> {
    return this.collectionsService.list(true);
  }

  @Post()
  @RequirePermissions("collection.create")
  @ApiOperation({ summary: "Create a collection" })
  create(@Body() dto: CollectionInput): Promise<CollectionDto> {
    return this.collectionsService.create(dto);
  }

  @Patch(":id")
  @RequirePermissions("collection.edit")
  @ApiOperation({ summary: "Update a collection" })
  update(@Param("id") id: string, @Body() dto: Partial<CollectionInput>): Promise<CollectionDto> {
    return this.collectionsService.update(id, dto);
  }

  @Put(":id/products")
  @RequirePermissions("collection.edit")
  @ApiOperation({ summary: "Replace collection products" })
  setProducts(@Param("id") id: string, @Body() dto: SetProductsInput): Promise<CollectionDto> {
    return this.collectionsService.setProducts(id, dto.productIds);
  }

  @Delete(":id")
  @RequirePermissions("collection.delete")
  @HttpCode(204)
  @ApiOperation({ summary: "Delete a collection" })
  remove(@Param("id") id: string): Promise<void> {
    return this.collectionsService.remove(id);
  }
}