import { LegalPlaceholder, legalMetadata } from "@/components/legal/legal-placeholder";

export const metadata = legalMetadata("Contact", "Contact the CreatorOS team.");

export default function ContactPage() {
  return <LegalPlaceholder title="Contact" />;
}
