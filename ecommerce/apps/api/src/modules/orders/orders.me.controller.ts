import { Body, Controller, Get, HttpCode, Param, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { Type } from "class-transformer";
import { OrderDto, OrderListResult, OrderStatusValues } from "@nexus/contracts";
import { CurrentUser as CurrentUserType } from "@nexus/contracts";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { OrdersService } from "./orders.service";

class OrdersListQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 10;

  @IsOptional()
  @IsIn(OrderStatusValues)
  status?: string;
}

@ApiTags("orders")
@ApiBearerAuth()
@Controller("users/me/orders")
export class OrdersMeController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @ApiOperation({ summary: "List my orders" })
  list(@Query() query: OrdersListQuery, @CurrentUser() user: CurrentUserType): Promise<OrderListResult> {
    return this.ordersService.listMine(user.id, query.page ?? 1, query.pageSize ?? 10, query.status);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get one of my orders by id" })
  detail(@Param("id") id: string, @CurrentUser() user: CurrentUserType): Promise<OrderDto> {
    return this.ordersService.findMine(user.id, id);
  }

  @Post(":id/cancel")
  @HttpCode(200)
  @ApiOperation({ summary: "Cancel one of my orders" })
  cancel(
    @Param("id") id: string,
    @Body() dto: { reason?: string },
    @CurrentUser() user: CurrentUserType,
  ): Promise<OrderDto> {
    return this.ordersService.cancelMine(user.id, id, dto.reason);
  }
}