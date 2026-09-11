import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getProduct } from "@/lib/data/products";
import { getUserContext, hasPermission } from "@/lib/auth";
import { PERM } from "@/lib/rbac";
import { ProductDetailClient } from "@/components/sales/product-detail";

export const metadata: Metadata = { title: "Product" };
export const dynamic = "force-dynamic";

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getProduct(id);
  if (!detail) notFound();

  const ctx = await getUserContext();
  const canEdit = hasPermission(ctx, PERM.productEdit);

  return <ProductDetailClient detail={detail} canEdit={canEdit} />;
}