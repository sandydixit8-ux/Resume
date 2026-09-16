import { Module } from "@nestjs/common";
import { InventoryService } from "./inventory.service";
import { InventoryController } from "./inventory.controller";
import { InventoryAdminController } from "./inventory.admin.controller";

@Module({
  providers: [InventoryService],
  controllers: [InventoryController, InventoryAdminController],
  exports: [InventoryService],
})
export class InventoryModule {}