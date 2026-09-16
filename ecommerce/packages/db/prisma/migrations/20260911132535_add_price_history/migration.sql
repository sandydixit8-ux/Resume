-- DropIndex
DROP INDEX "products_name_trgm_gist";

-- CreateTable
CREATE TABLE "price_history" (
    "id" UUID NOT NULL,
    "product_id" UUID,
    "product_variant_id" UUID,
    "field_name" TEXT NOT NULL,
    "from_value" DECIMAL(12,2) NOT NULL,
    "to_value" DECIMAL(12,2) NOT NULL,
    "reason" TEXT,
    "actor_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "price_history_product_id_created_at_idx" ON "price_history"("product_id", "created_at");

-- CreateIndex
CREATE INDEX "price_history_product_variant_id_created_at_idx" ON "price_history"("product_variant_id", "created_at");

-- AddForeignKey
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_product_variant_id_fkey" FOREIGN KEY ("product_variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
