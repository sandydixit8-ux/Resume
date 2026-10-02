import { LegalPlaceholder, legalMetadata } from "@/components/legal/legal-placeholder";

export const metadata = legalMetadata("Cookie Policy", "CreatorOS Cookie Policy (pending legal review).");

export default function CookiePolicyPage() {
  return <LegalPlaceholder title="Cookie Policy" />;
}
