import { Module } from "@nestjs/common";
import { InventoryModule } from "../inventory/inventory.module";
import { PricingModule } from "../pricing/pricing.module";
import { OrdersService } from "./orders.service";
import { CheckoutService } from "./checkout.service";
import { CheckoutController, CheckoutAuthController } from "./checkout.controller";
import { OrdersMeController } from "./orders.me.controller";
import { OrdersAdminController } from "./orders.admin.controller";

@Module({
  imports: [InventoryModule, PricingModule],
  providers: [OrdersService, CheckoutService],
  controllers: [CheckoutController, CheckoutAuthController, OrdersMeController, OrdersAdminController],
  exports: [OrdersService, CheckoutService],
})
export class OrdersModule {}