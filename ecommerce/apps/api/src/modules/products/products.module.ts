import { Module } from "@nestjs/common";
import { ProductsController, ProductsAdminController } from "./products.controller";
import { ProductsService } from "./products.service";
import { SearchModule } from "../search/search.module";

@Module({
  imports: [SearchModule],
  controllers: [ProductsController, ProductsAdminController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}