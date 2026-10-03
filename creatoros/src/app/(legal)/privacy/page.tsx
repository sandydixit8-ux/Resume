import { LegalList, LegalPage, LegalSection, legalMetadata } from "@/components/legal/legal-page";
import { LEGAL_INFO } from "@/components/legal/legal-info";

export const metadata = legalMetadata(
  "Privacy Policy",
  "How CreatorOS collects and uses personal data (draft pending legal review).",
);

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        This Privacy Policy explains what personal data {LEGAL_INFO.entityName} (&quot;CreatorOS&quot;,
        &quot;we&quot;) collects, why we collect it, and the rights you have. It covers our website and
        the CreatorOS platform.
      </p>

      <LegalSection heading="1. Data controller">
        <p>
          The data controller is {LEGAL_INFO.entityName}, {LEGAL_INFO.address}. Privacy requests:{" "}
          {LEGAL_INFO.privacyEmail}.
        </p>
      </LegalSection>

      <LegalSection heading="2. What we collect">
        <LegalList
          items={[
            <>
              <strong>Account data:</strong> name, email address, and a hashed password (we never store
              your password in plain text).
            </>,
            <>
              <strong>Profile and content:</strong> the bio pages, links, products, courses, bookings,
              email lists, messages and media you add.
            </>,
            <>
              <strong>Payment data:</strong> handled by Cashfree. We receive order, subscription and
              limited transaction details, but not your full card number.
            </>,
            <>
              <strong>Usage and analytics:</strong> first-party page-view and click events (a visitor
              identifier, pages viewed, referrers) stored in our own database and shown to you as
              analytics.
            </>,
            <>
              <strong>Technical data:</strong> IP address, device and browser information, and cookies
              (see the Cookie Policy).
            </>,
            <>
              <strong>Support data:</strong> messages you send to us and tickets you raise.
            </>,
          ]}
        />
      </LegalSection>

      <LegalSection heading="3. How we use it">
        <LegalList
          items={[
            "to provide, operate, secure and improve the service;",
            "to create and manage your account and process payments and subscriptions;",
            "to send transactional email (such as password resets and receipts) and, where you opt in, marketing;",
            "to provide analytics about your pages and audience;",
            "to detect, prevent and address fraud, abuse and security issues; and",
            "to comply with legal, tax and accounting obligations.",
          ]}
        />
      </LegalSection>

      <LegalSection heading="4. Legal bases">
        <p>
          Where UK or EU GDPR applies, we rely on: performance of a contract (to provide the service),
          legitimate interests (security, fraud prevention, analytics and service improvement), consent
          (non-essential cookies and marketing), and legal obligation (tax and accounting). Where the
          CCPA/CPRA applies to California residents, the categories and purposes above describe our
          processing, and we do not sell personal data.
        </p>
      </LegalSection>

      <LegalSection heading="5. Sharing">
        <p>
          We share data with processors that help us run the service, currently including Cloudflare
          (hosting/CDN and security), Cashfree (payments) and Brevo (transactional email), and with
          authorities where we are legally required to do so. We do not sell personal data.
        </p>
      </LegalSection>

      <LegalSection heading="6. International transfers">
        <p>
          Some processors may store or process data outside {LEGAL_INFO.governingLaw}. Where that
          happens, we rely on appropriate safeguards such as the UK Addendum, the EU Standard
          Contractual Clauses, or an equivalent mechanism.
        </p>
      </LegalSection>

      <LegalSection heading="7. Retention">
        <p>
          We keep personal data while your account is active and for a reasonable period afterwards to
          meet legal, tax, accounting and security needs. When it is no longer needed, we delete or
          anonymise it. If you delete your account, we will remove or anonymise your personal data except
          where we must keep it by law.
        </p>
      </LegalSection>

      <LegalSection heading="8. Your rights">
        <p>
          Depending on where you live, you may have the right to access, correct, delete, port, restrict
          or object to our processing of your personal data, and to withdraw consent at any time. We offer
          account export and deletion from your settings. To make a request, contact{" "}
          {LEGAL_INFO.privacyEmail}. UK/EU users may also complain to their local supervisory authority.
        </p>
      </LegalSection>

      <LegalSection heading="9. Cookies">
        <p>We use cookies as described in our Cookie Policy.</p>
      </LegalSection>

      <LegalSection heading="10. Security">
        <p>
          We use industry-standard measures including encrypted transport (TLS), hashed passwords and
          access controls. No method of transmission or storage is completely secure, so we cannot
          guarantee absolute security.
        </p>
      </LegalSection>

      <LegalSection heading="11. Children">
        <p>
          The service is not directed to children below the minimum age at which they can consent to data
          processing in their jurisdiction. If you believe a child has provided us personal data, contact
          us and we will delete it.
        </p>
      </LegalSection>

      <LegalSection heading="12. Changes and contact">
        <p>
          We may update this policy; material changes will be notified before they take effect. For any
          privacy question or request, contact {LEGAL_INFO.privacyEmail} or {LEGAL_INFO.supportEmail}.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
