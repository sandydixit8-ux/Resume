import type { Metadata } from "next";
import { ProductsForm } from "@/components/onboarding/products-form";

export const metadata: Metadata = { title: "Products" };

export default function ProductsPage() {
  return <ProductsForm />;
}