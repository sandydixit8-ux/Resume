import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCustomerDetail } from "@/lib/data/customers";
import { CustomerDetailClient } from "@/components/customers/customer-detail-client";

export const metadata: Metadata = { title: "Customer" };
export const dynamic = "force-dynamic";

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getCustomerDetail(id);
  if (!detail) notFound();

  return <CustomerDetailClient {...detail} />;
}