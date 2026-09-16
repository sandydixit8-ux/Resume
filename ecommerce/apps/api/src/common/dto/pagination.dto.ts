import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, IsIn, Min, Max } from "class-validator";
import { Direction, PageQuery, SortQuery } from "@nexus/contracts";

export class PaginationDto implements PageQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;
}

export class SortDto implements SortQuery {
  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsIn(["asc", "desc"])
  direction: Direction = "asc";
}

export class PaginatedParamsDto extends PaginationDto {};