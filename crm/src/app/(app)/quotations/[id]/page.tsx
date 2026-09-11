import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getQuotation } from "@/lib/data/sales";
import { QuotationDetailClient } from "@/components/sales/quotation-detail";

export const metadata: Metadata = { title: "Quotation" };
export const dynamic = "force-dynamic";

export default async function QuotationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getQuotation(id);
  if (!detail) notFound();
  return <QuotationDetailClient detail={detail} />;
}