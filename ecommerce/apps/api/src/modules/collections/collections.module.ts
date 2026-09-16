import { Module } from "@nestjs/common";
import { CollectionsController, CollectionsAdminController } from "./collections.controller";
import { CollectionsService } from "./collections.service";

@Module({
  controllers: [CollectionsController, CollectionsAdminController],
  providers: [CollectionsService],
  exports: [CollectionsService],
})
export class CollectionsModule {}