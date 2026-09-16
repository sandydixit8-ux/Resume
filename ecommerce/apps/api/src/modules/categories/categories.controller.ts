import { Controller, Get, Param } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { CategoryDetail, CategoryNode } from "@nexus/contracts";
import { Public } from "../../common/decorators/public.decorator";
import { CategoriesService } from "./categories.service";

@ApiTags("catalog")
@Public()
@Controller("categories")
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @ApiOperation({ summary: "Nested category tree" })
  tree(): Promise<CategoryNode[]> {
    return this.categoriesService.tree(false);
  }

  @Get(":slug")
  @ApiOperation({ summary: "Category detail with children and breadcrumbs" })
  detail(@Param("slug") slug: string): Promise<CategoryDetail> {
    return this.categoriesService.findBySlug(slug);
  }
}