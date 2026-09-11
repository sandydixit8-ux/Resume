import type { Metadata } from "next";
import { CustomerForm } from "@/components/customers/customer-form";

export const metadata: Metadata = { title: "New customer" };
export const dynamic = "force-dynamic";

export default function NewCustomerPage() {
  return <CustomerForm />;
}