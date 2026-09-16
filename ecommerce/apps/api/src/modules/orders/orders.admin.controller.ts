import { Body, Controller, Get, Param, Patch, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { IsIn, IsInt, IsOptional, IsString, Max, Min, MaxLength } from "class-validator";
import { Type } from "class-transformer";
import { OrderDto, OrderListResult, OrderStatusValues } from "@nexus/contracts";
import { CurrentUser as CurrentUserType } from "@nexus/contracts";
import { RequirePermissions } from "../../common/decorators/rbac.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { OrdersService } from "./orders.service";

class AdminOrdersListQuery {
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

class UpdateOrderStatusDto {
  @IsIn(OrderStatusValues)
  toStatus!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

@ApiTags("admin-orders")
@ApiBearerAuth()
@Controller("admin/orders")
export class OrdersAdminController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @RequirePermissions("order.view")
  @ApiOperation({ summary: "List orders with optional status filter" })
  list(@Query() query: AdminOrdersListQuery): Promise<OrderListResult> {
    return this.ordersService.adminList(query.page ?? 1, query.pageSize ?? 10, query.status);
  }

  @Get(":id")
  @RequirePermissions("order.view")
  @ApiOperation({ summary: "Get order detail" })
  detail(@Param("id") id: string): Promise<OrderDto> {
    return this.ordersService.adminGet(id);
  }

  @Patch(":id/status")
  @RequirePermissions("order.update_status")
  @ApiOperation({ summary: "Transition an order to a legal next status" })
  updateStatus(
    @Param("id") id: string,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentUser() user: CurrentUserType,
  ): Promise<OrderDto> {
    return this.ordersService.adminUpdateStatus(id, dto.toStatus, user.id, dto.reason);
  }
}