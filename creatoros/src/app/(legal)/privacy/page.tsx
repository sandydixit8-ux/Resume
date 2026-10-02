import { LegalPlaceholder, legalMetadata } from "@/components/legal/legal-placeholder";

export const metadata = legalMetadata("Privacy Policy", "CreatorOS Privacy Policy (pending legal review).");

export default function PrivacyPage() {
  return <LegalPlaceholder title="Privacy Policy" />;
}
