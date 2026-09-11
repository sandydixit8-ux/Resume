import type { Metadata } from "next";
import { listProductCategories } from "@/lib/data/products";
import { ProductForm } from "@/components/sales/product-form";

export const metadata: Metadata = { title: "New product" };

export default async function NewProductPage() {
  const categories = await listProductCategories();
  return <ProductForm categories={categories} />;
}