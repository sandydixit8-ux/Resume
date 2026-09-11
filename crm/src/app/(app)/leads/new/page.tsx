import type { Metadata } from "next";
import { LeadForm } from "@/components/leads/lead-form";

export const metadata: Metadata = { title: "New lead" };

export default function NewLeadPage() {
  return <LeadForm />;
}