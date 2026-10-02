import { LegalPlaceholder, legalMetadata } from "@/components/legal/legal-placeholder";

export const metadata = legalMetadata("Refund Policy", "CreatorOS Refund Policy (pending legal review).");

export default function RefundPolicyPage() {
  return <LegalPlaceholder title="Refund Policy" />;
}
