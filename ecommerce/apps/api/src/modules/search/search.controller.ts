import { Controller, Get, Post, HttpCode } from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
import { RequirePermissions } from "../../common/decorators/rbac.decorator";
import { SearchService } from "./search.service";
import type { SearchStatusDto, ReindexResultDto } from "@nexus/contracts";

@ApiTags("search")
@Controller("search")
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Public()
  @Get("status")
  @ApiOperation({ summary: "Typesense search engine status" })
  status(): Promise<SearchStatusDto> {
    return this.searchService.status();
  }

  @Post("reindex")
  @HttpCode(200)
  @ApiBearerAuth()
  @RequirePermissions("catalog.edit")
  @ApiOperation({ summary: "Reindex all active products into Typesense" })
  reindex(): Promise<ReindexResultDto> {
    return this.searchService.reindex();
  }
}
