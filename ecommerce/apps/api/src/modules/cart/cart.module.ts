import { Module } from "@nestjs/common";
import { CartService } from "./cart.service";
import { CartController, CartAuthController } from "./cart.controller";
import { PricingModule } from "../pricing/pricing.module";

@Module({
  imports: [PricingModule],
  providers: [CartService],
  controllers: [CartController, CartAuthController],
  exports: [CartService],
})
export class CartModule {}