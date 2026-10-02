import { LegalPlaceholder, legalMetadata } from "@/components/legal/legal-placeholder";

export const metadata = legalMetadata("Terms of Service", "CreatorOS Terms of Service (pending legal review).");

export default function TermsPage() {
  return <LegalPlaceholder title="Terms of Service" />;
}
