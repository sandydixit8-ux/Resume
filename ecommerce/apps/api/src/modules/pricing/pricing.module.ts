import { Module } from "@nestjs/common";
import { PricingService } from "./pricing.service";
import { PricingController, QuoteController } from "./pricing.controller";

@Module({
  providers: [PricingService],
  controllers: [PricingController, QuoteController],
  exports: [PricingService],
})
export class PricingModule {}