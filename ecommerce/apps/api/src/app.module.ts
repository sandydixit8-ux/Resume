import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule, ThrottlerModuleOptions } from "@nestjs/throttler";
import { LoggerModule } from "nestjs-pino";
import { validationSchema } from "./config/env.validation";
import { RequestIdMiddleware } from "./common/middleware/request-id.middleware";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { RbacGuard } from "./common/guards/rbac.guard";
import { PrismaModule } from "./prisma/prisma.module";
import { HealthModule } from "./modules/health/health.module";
import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";
import { RbacModule } from "./modules/rbac/rbac.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { CategoriesModule } from "./modules/categories/categories.module";
import { BrandsModule } from "./modules/brands/brands.module";
import { AttributesModule } from "./modules/attributes/attributes.module";
import { ProductsModule } from "./modules/products/products.module";
import { CollectionsModule } from "./modules/collections/collections.module";
import { CartModule } from "./modules/cart/cart.module";
import { OrdersModule } from "./modules/orders/orders.module";
import { InventoryModule } from "./modules/inventory/inventory.module";
import { PricingModule } from "./modules/pricing/pricing.module";
import { SearchModule } from "./modules/search/search.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validationSchema,
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        pinoHttp: {
          level: config.get<string>("LOG_LEVEL") ?? "info",
          genReqId: (req) => {
            const header = (req.headers["x-request-id"] as string) ?? undefined;
            return header ?? crypto.randomUUID();
          },
          transport:
            config.get<string>("NODE_ENV") !== "production"
              ? { target: "pino-pretty", options: { singleLine: true } }
              : undefined,
        },
      }),
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService): ThrottlerModuleOptions => ({
        throttlers: [
          {
            ttl: config.get<number>("THROTTLE_TTL_MS") ?? 60000,
            limit: config.get<number>("THROTTLE_LIMIT") ?? 100,
          },
        ],
      }),
    }),
    PrismaModule,
    NotificationsModule,
    HealthModule,
    AuthModule,
    UsersModule,
    RbacModule,
    CategoriesModule,
    BrandsModule,
    AttributesModule,
    ProductsModule,
    CollectionsModule,
    CartModule,
    OrdersModule,
    InventoryModule,
    PricingModule,
    SearchModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RbacGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes("*");
  }
}