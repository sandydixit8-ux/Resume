import type { Metadata } from "next";
import { BusinessForm } from "@/components/onboarding/business-form";

export const metadata: Metadata = { title: "Business setup" };

export default function BusinessPage() {
  return <BusinessForm />;
}