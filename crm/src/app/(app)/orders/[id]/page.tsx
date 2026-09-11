import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getOrder } from "@/lib/data/sales";
import { OrderDetailClient } from "@/components/sales/order-detail";

export const metadata: Metadata = { title: "Order" };
export const dynamic = "force-dynamic";

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getOrder(id);
  if (!detail) notFound();
  return <OrderDetailClient detail={detail} />;
}