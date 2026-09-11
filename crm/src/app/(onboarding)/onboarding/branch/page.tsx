import type { Metadata } from "next";
import { BranchForm } from "@/components/onboarding/branch-form";

export const metadata: Metadata = { title: "Branch setup" };

export default function BranchPage() {
  return <BranchForm />;
}