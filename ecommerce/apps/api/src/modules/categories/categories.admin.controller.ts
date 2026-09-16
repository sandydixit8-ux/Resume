import { Body, Controller, Delete, HttpCode, Param, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength } from "class-validator";
import { CategoryDto } from "@nexus/contracts";
import { RequirePermissions } from "../../common/decorators/rbac.decorator";
import { CategoriesService, CategoryCreateInput } from "./categories.service";

class CreateCategoryDto implements CategoryCreateInput {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  slug?: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

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
  @IsString()
  seoKeywords?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

class UpdateCategoryDto extends CreateCategoryDto {}

class MoveCategoryDto {
  @IsOptional()
  @IsUUID()
  parentId?: string | null;
}

class BindAttributeDto {
  @IsUUID()
  attributeId!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}

@ApiTags("admin-catalog")
@ApiBearerAuth()
@Controller("admin/categories")
export class CategoriesAdminController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @RequirePermissions("category.create")
  @ApiOperation({ summary: "Create a category" })
  create(@Body() dto: CreateCategoryDto): Promise<CategoryDto> {
    return this.categoriesService.create(dto);
  }

  @Patch(":id")
  @RequirePermissions("category.edit")
  @ApiOperation({ summary: "Update a category" })
  update(@Param("id") id: string, @Body() dto: Partial<UpdateCategoryDto>): Promise<CategoryDto> {
    return this.categoriesService.update(id, dto);
  }

  @Post(":id/move")
  @RequirePermissions("category.move")
  @ApiOperation({ summary: "Move a category under another parent" })
  move(@Param("id") id: string, @Body() dto: MoveCategoryDto): Promise<CategoryDto> {
    return this.categoriesService.move(id, dto.parentId ?? null);
  }

  @Delete(":id")
  @RequirePermissions("category.delete")
  @HttpCode(204)
  @ApiOperation({ summary: "Soft-delete a category" })
  remove(@Param("id") id: string): Promise<void> {
    return this.categoriesService.remove(id);
  }

  @Post(":id/attributes")
  @RequirePermissions("category.edit")
  @ApiOperation({ summary: "Bind an attribute to a category" })
  bindAttribute(@Param("id") id: string, @Body() dto: BindAttributeDto): Promise<void> {
    return this.categoriesService.bindAttribute(id, dto.attributeId, dto.position ?? 0);
  }

  @Delete(":id/attributes/:attributeId")
  @RequirePermissions("category.edit")
  @HttpCode(204)
  @ApiOperation({ summary: "Unbind an attribute from a category" })
  unbindAttribute(@Param("id") id: string, @Param("attributeId") attributeId: string): Promise<void> {
    return this.categoriesService.unbindAttribute(id, attributeId);
  }
}