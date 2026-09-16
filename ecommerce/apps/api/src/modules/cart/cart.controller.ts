import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Patch,
  Post,
  Req,
  Res,
  UseInterceptors,
} from "@nestjs/common";
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from "@nestjs/swagger";
import { IsInt, IsUUID, Min } from "class-validator";
import { CartDto } from "@nexus/contracts";
import { Public } from "../../common/decorators/public.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { CurrentUser as CurrentUserType } from "@nexus/contracts";
import { CartService } from "./cart.service";
import type { Response, Request } from "express";

class AddItemDto {
  @IsUUID("4")
  variantId!: string;

  @IsInt()
  @Min(1)
  quantity: number = 1;
}

class UpdateQuantityDto {
  @IsInt()
  @Min(1)
  quantity!: number;
}

@ApiTags("cart")
@Public()
@Controller("cart")
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @ApiOperation({ summary: "Get current cart" })
  @ApiHeader({ name: "x-cart-token", required: false })
  async getCart(@Headers("x-cart-token") token: string | undefined): Promise<CartDto> {
    return this.cartService.getCart(token);
  }

  @Post("items")
  @HttpCode(200)
  @ApiOperation({ summary: "Add item to cart" })
  @ApiHeader({ name: "x-cart-token", required: false })
  async addItem(
    @Headers("x-cart-token") token: string | undefined,
    @Body() dto: AddItemDto,
  ): Promise<CartDto> {
    const result = await this.cartService.addItem(token, dto);
    return result.cart;
  }

  @Patch("items/:itemId")
  @ApiOperation({ summary: "Update cart item quantity" })
  @ApiHeader({ name: "x-cart-token", required: false })
  async updateItem(
    @Headers("x-cart-token") token: string | undefined,
    @Req() req: Request & { params: { itemId: string } },
    @Body() dto: UpdateQuantityDto,
  ): Promise<CartDto> {
    return this.cartService.updateItemQuantity(token, req.params.itemId, dto.quantity);
  }

  @Delete("items/:itemId")
  @HttpCode(200)
  @ApiOperation({ summary: "Remove item from cart" })
  @ApiHeader({ name: "x-cart-token", required: false })
  async removeItem(
    @Headers("x-cart-token") token: string | undefined,
    @Req() req: Request & { params: { itemId: string } },
  ): Promise<CartDto> {
    return this.cartService.removeItem(token, req.params.itemId);
  }

  @Delete()
  @HttpCode(200)
  @ApiOperation({ summary: "Clear cart" })
  @ApiHeader({ name: "x-cart-token", required: false })
  async clear(@Headers("x-cart-token") token: string | undefined): Promise<CartDto> {
    return this.cartService.clear(token);
  }
}

@ApiTags("cart")
@ApiBearerAuth()
@Controller("cart")
export class CartAuthController {
  constructor(private readonly cartService: CartService) {}

  @Post("merge")
  @ApiOperation({ summary: "Merge anonymous cart into logged-in user's cart" })
  @ApiHeader({ name: "x-cart-token", required: true })
  async merge(
    @Headers("x-cart-token") token: string | undefined,
    @CurrentUser() user: CurrentUserType,
  ): Promise<CartDto> {
    if (!token) return this.cartService.getCart(undefined);
    return this.cartService.mergeAnonymousToUser(token, user.id);
  }
}