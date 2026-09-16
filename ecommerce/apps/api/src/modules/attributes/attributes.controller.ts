import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  Min,
} from "class-validator";
import { AttributeDataType, AttributeDto, AttributeValueDto } from "@nexus/contracts";
import { RequirePermissions } from "../../common/decorators/rbac.decorator";
import { Public } from "../../common/decorators/public.decorator";
import { AttributesService } from "./attributes.service";

class ListAttributesQuery {
  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  category?: string;
}

class AttributeValueInput {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  value!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  slug?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}

const DATA_TYPES = ["TEXT", "NUMBER", "BOOLEAN", "SELECT", "MULTISELECT", "COLOR"] as const;

class CreateAttributeDto {
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  code!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsIn(DATA_TYPES)
  dataType!: AttributeDataType;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  unit?: string;

  @IsOptional()
  @IsBoolean()
  isVariantAxis?: boolean;

  @IsOptional()
  @IsBoolean()
  isFilterable?: boolean;

  @IsOptional()
  values?: AttributeValueInput[];
}

@ApiTags("catalog")
@Public()
@Controller("attributes")
export class AttributesController {
  constructor(private readonly attributesService: AttributesService) {}

  @Get()
  @ApiOperation({ summary: "List attributes (optionally for a category)" })
  list(@Query() query: ListAttributesQuery): Promise<AttributeDto[]> {
    return this.attributesService.list(query.categoryId, query.category);
  }
}

@ApiTags("admin-catalog")
@ApiBearerAuth()
@Controller("admin/attributes")
export class AttributesAdminController {
  constructor(private readonly attributesService: AttributesService) {}

  @Get()
  @RequirePermissions("attribute.view")
  @ApiOperation({ summary: "List all attributes" })
  list(): Promise<AttributeDto[]> {
    return this.attributesService.list();
  }

  @Post()
  @RequirePermissions("attribute.create")
  @ApiOperation({ summary: "Create an attribute with values" })
  create(@Body() dto: CreateAttributeDto): Promise<AttributeDto> {
    return this.attributesService.create(dto);
  }

  @Patch(":id")
  @RequirePermissions("attribute.edit")
  @ApiOperation({ summary: "Update an attribute" })
  update(@Param("id") id: string, @Body() dto: Partial<CreateAttributeDto>): Promise<AttributeDto> {
    return this.attributesService.update(id, dto);
  }

  @Post(":id/values")
  @RequirePermissions("attribute.edit")
  @ApiOperation({ summary: "Add a value to an attribute" })
  addValue(@Param("id") id: string, @Body() dto: AttributeValueInput): Promise<AttributeValueDto> {
    return this.attributesService.addValue(id, dto);
  }

  @Delete(":id/values/:valueId")
  @RequirePermissions("attribute.delete")
  @HttpCode(204)
  @ApiOperation({ summary: "Remove an attribute value" })
  removeValue(@Param("id") id: string, @Param("valueId") valueId: string): Promise<void> {
    return this.attributesService.removeValue(id, valueId);
  }

  @Delete(":id")
  @RequirePermissions("attribute.delete")
  @HttpCode(204)
  @ApiOperation({ summary: "Delete an attribute" })
  remove(@Param("id") id: string): Promise<void> {
    return this.attributesService.remove(id);
  }
}