import type { Metadata } from "next";
import { listCustomerOptions } from "@/lib/data/sales";
import { listProductOptions } from "@/lib/data/products";
import { getAssignableUsers } from "@/lib/data/leads";
import { QuotationForm } from "@/components/sales/quotation-form";

export const metadata: Metadata = { title: "New quotation" };
export const dynamic = "force-dynamic";

export default async function NewQuotationPage() {
  const [customers, products, salespeople] = await Promise.all([listCustomerOptions(), listProductOptions(), getAssignableUsers()]);
  return <QuotationForm customers={customers} products={products} salespeople={salespeople} />;
}