/*
  Warnings:

  - Changed the type of `type` on the `promotions` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "PromotionType" AS ENUM ('PERCENTAGE_OFF', 'FLAT_OFF');

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "promo_discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "promotion_id" UUID,
ADD COLUMN     "promotion_name" TEXT,
ADD COLUMN     "promotion_type" TEXT,
ADD COLUMN     "tier_min_quantity" INTEGER;

-- AlterTable
ALTER TABLE "promotions" ADD COLUMN     "scope" TEXT NOT NULL DEFAULT 'ALL',
DROP COLUMN "type",
ADD COLUMN     "type" "PromotionType" NOT NULL;

-- CreateTable
CREATE TABLE "price_tiers" (
    "id" UUID NOT NULL,
    "product_variant_id" UUID NOT NULL,
    "min_quantity" INTEGER NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotion_items" (
    "id" UUID NOT NULL,
    "promotion_id" UUID NOT NULL,
    "product_id" UUID,
    "product_variant_id" UUID,
    "userId" UUID,

    CONSTRAINT "promotion_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "price_tiers_product_variant_id_is_active_idx" ON "price_tiers"("product_variant_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "price_tiers_product_variant_id_min_quantity_key" ON "price_tiers"("product_variant_id", "min_quantity");

-- CreateIndex
CREATE INDEX "promotion_items_promotion_id_idx" ON "promotion_items"("promotion_id");

-- CreateIndex
CREATE INDEX "promotion_items_product_variant_id_idx" ON "promotion_items"("product_variant_id");

-- CreateIndex
CREATE INDEX "promotions_is_active_start_at_end_at_idx" ON "promotions"("is_active", "start_at", "end_at");

-- AddForeignKey
ALTER TABLE "price_tiers" ADD CONSTRAINT "price_tiers_product_variant_id_fkey" FOREIGN KEY ("product_variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_promotion_id_fkey" FOREIGN KEY ("promotion_id") REFERENCES "promotions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_items" ADD CONSTRAINT "promotion_items_promotion_id_fkey" FOREIGN KEY ("promotion_id") REFERENCES "promotions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_items" ADD CONSTRAINT "promotion_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_items" ADD CONSTRAINT "promotion_items_product_variant_id_fkey" FOREIGN KEY ("product_variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_items" ADD CONSTRAINT "promotion_items_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
