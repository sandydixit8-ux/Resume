import { LegalList, LegalPage, LegalSection, legalMetadata } from "@/components/legal/legal-page";
import { LEGAL_INFO } from "@/components/legal/legal-info";

export const metadata = legalMetadata(
  "Refund Policy",
  "When and how CreatorOS issues refunds (draft pending legal review).",
);

export default function RefundPolicyPage() {
  return (
    <LegalPage title="Refund Policy">
      <p>
        This Refund Policy explains when you can get a refund for CreatorOS subscriptions and one-time
        purchases. It forms part of our Terms of Service.
      </p>

      <LegalSection heading="Subscriptions">
        <LegalList
          items={[
            "You can cancel at any time from the Billing page. Cancellation stops future renewals and your access continues until the end of the period you already paid for.",
            `If you are charged and change your mind, you may request a refund of the current period within ${LEGAL_INFO.refundWindowDays} days of the charge, provided the plan has not been materially used.`,
            "Renewals are charged automatically until you cancel, so please cancel before the renewal date if you do not wish to continue.",
          ]}
        />
      </LegalSection>

      <LegalSection heading="One-time purchases (products, courses, bookings)">
        <LegalList
          items={[
            `Digital products and courses are refundable within ${LEGAL_INFO.refundWindowDays} days if the content has not been substantially accessed.`,
            "Once you have substantially accessed or downloaded digital content, the purchase is generally non-refundable, except where the law requires a refund.",
            "Bookings are governed by the cancellation terms shown at checkout and by the creator offering the booking.",
          ]}
        />
      </LegalSection>

      <LegalSection heading="How to request a refund">
        <p>
          Email {LEGAL_INFO.supportEmail} from your account email with your order or payment reference.
          We aim to respond within {LEGAL_INFO.responseBusinessDays} business days. Approved refunds are
          issued to the original payment method through Cashfree; timing of the funds depends on your bank
          or card issuer.
        </p>
      </LegalSection>

      <LegalSection heading="Exceptions and your statutory rights">
        <p>
          Consumers in the UK and EU may have a statutory right to cancel within 14 days of purchase. For
          digital content supplied immediately, that right can be lost once you consent to immediate
          supply and acknowledge that you lose the right to cancel. Nothing in this policy overrides or
          limits any statutory consumer rights you have.
        </p>
      </LegalSection>

      <LegalSection heading="Contact">
        <p>
          Questions about refunds: {LEGAL_INFO.supportEmail}.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
