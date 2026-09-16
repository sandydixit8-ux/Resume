import { Module } from "@nestjs/common";
import { BrandsController, BrandsAdminController } from "./brands.controller";
import { BrandsService } from "./brands.service";

@Module({
  controllers: [BrandsController, BrandsAdminController],
  providers: [BrandsService],
  exports: [BrandsService],
})
export class BrandsModule {}