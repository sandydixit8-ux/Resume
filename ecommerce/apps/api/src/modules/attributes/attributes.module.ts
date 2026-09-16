import { Module } from "@nestjs/common";
import { AttributesController, AttributesAdminController } from "./attributes.controller";
import { AttributesService } from "./attributes.service";

@Module({
  controllers: [AttributesController, AttributesAdminController],
  providers: [AttributesService],
  exports: [AttributesService],
})
export class AttributesModule {}