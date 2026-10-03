import { LegalList, LegalPage, LegalSection, legalMetadata } from "@/components/legal/legal-page";
import { LEGAL_INFO } from "@/components/legal/legal-info";

export const metadata = legalMetadata(
  "Contact",
  "How to contact the CreatorOS team (draft pending legal review).",
);

export default function ContactPage() {
  return (
    <LegalPage title="Contact">
      <p>We are happy to help. Here is how to reach us.</p>

      <LegalSection heading="Who we are">
        <p>
          {LEGAL_INFO.entityName}
          <br />
          {LEGAL_INFO.companyNumber}
          <br />
          {LEGAL_INFO.address}
        </p>
      </LegalSection>

      <LegalSection heading="Get in touch">
        <LegalList
          items={[
            <>
              <strong>Support:</strong> {LEGAL_INFO.supportEmail}
            </>,
            <>
              <strong>Privacy requests:</strong> {LEGAL_INFO.privacyEmail}
            </>,
            <>
              <strong>Legal:</strong> {LEGAL_INFO.supportEmail}
            </>,
            <>
              <strong>Response time:</strong> within {LEGAL_INFO.responseBusinessDays} business days
            </>,
          ]}
        />
      </LegalSection>

      <LegalSection heading="Complaints">
        <p>
          If you have a complaint, contact us first and we will try to resolve it. UK/EU users may also
          contact their local data protection authority about privacy concerns.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
