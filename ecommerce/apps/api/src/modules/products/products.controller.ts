import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import { ProductDetail, ProductListResult, ProductStatus, ProductSummary } from "@nexus/contracts";
import { RequirePermissions } from "../../common/decorators/rbac.decorator";
import { Public } from "../../common/decorators/public.decorator";
import { PaginationDto } from "../../common/dto/pagination.dto";
import {
  ProductCreateInput,
  ProductsService,
  ProductSort,
  ProductVariantInput,
  ProductAttributeInput,
  ProductImageInput,
} from "./products.service";
import { PartialType } from "@nestjs/swagger";

const SORTS = ["relevance", "newest", "price-asc", "price-desc", "rating", "popular"] as const;
const PRODUCT_STATUSES = ["DRAFT", "PENDING_REVIEW", "ACTIVE", "OUT_OF_STOCK", "ARCHIVED", "DISABLED"] as const;

class ProductListQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  attrs?: string;

  @IsOptional()
  @IsIn(SORTS)
  sort?: ProductSort;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  priceMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  priceMax?: number;
}

class AdminProductListQueryDto extends ProductListQueryDto {
  @IsOptional()
  @IsIn(PRODUCT_STATUSES)
  status?: ProductStatus;
}

class ImageInput implements ProductImageInput {
  @IsString()
  @MaxLength(600)
  url!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  alt?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

class ProductAttributeInputDto implements ProductAttributeInput {
  @IsUUID()
  attributeId!: string;

  @IsOptional()
  @IsUUID()
  attributeValueId?: string;

  @IsOptional()
  @IsString()
  valueText?: string;

  @IsOptional()
  @IsNumber()
  valueNumber?: number;
}

class VariantAttributeInputDto {
  @IsUUID()
  attributeId!: string;

  @IsOptional()
  @IsUUID()
  attributeValueId?: string;

  @IsOptional()
  @IsString()
  rawValue?: string;
}

class VariantInput implements ProductVariantInput {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  sku!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsNumber()
  @Min(0)
  price!: number;

  @IsNumber()
  @Min(0)
  mrp!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VariantAttributeInputDto)
  attributes?: VariantAttributeInputDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImageInput)
  images?: ImageInput[];
}

class CreateProductDto implements ProductCreateInput {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  sku!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  shortDescription?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  description?: string;

  @IsOptional()
  @IsUUID()
  brandId?: string;

  @IsUUID()
  categoryId!: string;

  @IsOptional()
  @IsIn(PRODUCT_STATUSES)
  status?: ProductStatus;

  @IsNumber()
  @Min(0)
  mrp!: number;

  @IsNumber()
  @Min(0)
  sellingPrice!: number;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  currency?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  weightG?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  lengthMm?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  widthMm?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  heightMm?: number;

  @IsOptional()
  @IsBoolean()
  returnEligible?: boolean;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  seoTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  seoDescription?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  seoKeywords?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImageInput)
  images?: ImageInput[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductAttributeInputDto)
  attributes?: ProductAttributeInputDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VariantInput)
  variants?: VariantInput[];
}

class UpdateProductDto extends PartialType(CreateProductDto) {}

@ApiTags("catalog")
@Public()
@Controller("products")
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @ApiOperation({ summary: "List/search products with facets" })
  list(@Query() query: ProductListQueryDto): Promise<ProductListResult> {
    return this.productsService.list({
      q: query.q,
      category: query.category,
      brand: query.brand,
      attrs: query.attrs,
      sort: query.sort,
      priceMin: query.priceMin,
      priceMax: query.priceMax,
      page: query.page,
      pageSize: query.pageSize,
    });
  }

  @Get(":slug")
  @ApiOperation({ summary: "Product detail" })
  detail(@Param("slug") slug: string): Promise<ProductDetail> {
    return this.productsService.detail(slug);
  }
}

@ApiTags("admin-catalog")
@ApiBearerAuth()
@Controller("admin/products")
export class ProductsAdminController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @RequirePermissions("catalog.view")
  @ApiOperation({ summary: "List products (all statuses)" })
  list(@Query() query: AdminProductListQueryDto): Promise<ProductListResult> {
    return this.productsService.adminList({
      category: query.category,
      brand: query.brand,
      attrs: query.attrs,
      sort: query.sort,
      priceMin: query.priceMin,
      priceMax: query.priceMax,
      page: query.page,
      pageSize: query.pageSize,
      status: query.status,
    });
  }

  @Post()
  @RequirePermissions("catalog.create")
  @ApiOperation({ summary: "Create a product with variants/images/attributes" })
  create(@Body() dto: CreateProductDto): Promise<ProductSummary> {
    return this.productsService.create(dto);
  }

  @Patch(":id")
  @RequirePermissions("catalog.edit")
  @ApiOperation({ summary: "Update a product (fields, status, images, attributes)" })
  update(@Param("id") id: string, @Body() dto: Partial<UpdateProductDto>): Promise<ProductSummary> {
    return this.productsService.update(id, dto);
  }

  @Delete(":id")
  @RequirePermissions("catalog.delete")
  @HttpCode(204)
  @ApiOperation({ summary: "Soft-delete a product" })
  remove(@Param("id") id: string): Promise<void> {
    return this.productsService.remove(id);
  }
}