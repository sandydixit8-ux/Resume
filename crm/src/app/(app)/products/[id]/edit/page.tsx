import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getProduct, listProductCategories } from "@/lib/data/products";
import { ProductForm } from "@/components/sales/product-form";

export const metadata: Metadata = { title: "Edit product" };
export const dynamic = "force-dynamic";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [detail, categories] = await Promise.all([getProduct(id), listProductCategories()]);
  if (!detail) notFound();
  return <ProductForm categories={categories} existing={detail.product} />;
}