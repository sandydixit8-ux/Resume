import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { PaymentMethodValues, PlaceOrderResult } from "@nexus/contracts";
import { CurrentUser as CurrentUserType } from "@nexus/contracts";
import { Public } from "../../common/decorators/public.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { CheckoutService } from "./checkout.service";

export class ShippingAddressDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName!: string;

  @IsString()
  @MinLength(7)
  @MaxLength(20)
  phone!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(200)
  line1!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  line2?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  city!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  state!: string;

  @IsString()
  pincode!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  country?: string;
}

export class PlaceOrderDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  cartToken?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ValidateNested()
  @Type(() => ShippingAddressDto)
  shippingAddress!: ShippingAddressDto;

  @IsIn(PaymentMethodValues)
  paymentMethod!: (typeof PaymentMethodValues)[number];

  @IsString()
  @MinLength(8)
  @MaxLength(64)
  idempotencyKey!: string;
}

@ApiTags("checkout")
@Public()
@Controller("checkout")
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post("place-order/guest")
  @HttpCode(200)
  @ApiOperation({ summary: "Place an order as a guest from an anonymous cart" })
  placeGuestOrder(@Body() dto: PlaceOrderDto): Promise<PlaceOrderResult> {
    return this.checkoutService.placeOrder(dto, {});
  }

  @Get("sessions/:sessionId")
  @ApiOperation({ summary: "Look up a completed checkout by session id or idempotency key" })
  findSession(@Param("sessionId") sessionId: string): Promise<PlaceOrderResult> {
    return this.checkoutService.findSession(sessionId);
  }
}

@ApiTags("checkout")
@ApiBearerAuth()
@Controller("checkout")
export class CheckoutAuthController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post("place-order")
  @HttpCode(200)
  @ApiOperation({ summary: "Place an order as a logged-in customer" })
  placeOrder(
    @Body() dto: PlaceOrderDto,
    @CurrentUser() user: CurrentUserType,
  ): Promise<PlaceOrderResult> {
    return this.checkoutService.placeOrder(dto, {
      userId: user.id,
      userEmail: user.email,
      userPhone: user.phone,
    });
  }
}