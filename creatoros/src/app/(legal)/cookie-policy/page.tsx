import { LegalList, LegalPage, LegalSection, legalMetadata } from "@/components/legal/legal-page";
import { LEGAL_INFO } from "@/components/legal/legal-info";

export const metadata = legalMetadata(
  "Cookie Policy",
  "How CreatorOS uses cookies and similar technologies (draft pending legal review).",
);

export default function CookiePolicyPage() {
  return (
    <LegalPage title="Cookie Policy">
      <p>
        This Cookie Policy explains how {LEGAL_INFO.entityName} uses cookies and similar technologies on
        the CreatorOS website and platform, and how you can manage them.
      </p>

      <LegalSection heading="What cookies are">
        <p>
          Cookies are small text files stored on your device. They help a website work, remember your
          preferences, and understand how it is used. Some similar technologies (such as local storage)
          work in comparable ways.
        </p>
      </LegalSection>

      <LegalSection heading="Cookies we use">
        <LegalList
          items={[
            <>
              <strong>Strictly necessary:</strong> session and authentication cookies required to log you
              in and keep the service secure. These cannot be switched off through our site.
            </>,
            <>
              <strong>Functional:</strong> cookies that remember your preferences (for example, theme or
              language).
            </>,
            <>
              <strong>Analytics:</strong> first-party tracking of page views and link clicks, stored in
              our own database, used to show you analytics for your pages. We do not use third-party
              advertising cookies.
            </>,
          ]}
        />
      </LegalSection>

      <LegalSection heading="Third parties">
        <p>
          Cloudflare (hosting/CDN and security) may set cookies needed to deliver and protect the site.
          Cashfree is involved only during checkout and may set its own cookies there. Their handling of
          data is governed by their own policies.
        </p>
      </LegalSection>

      <LegalSection heading="Managing cookies">
        <p>
          You can block, delete or manage cookies in your browser settings. If you disable strictly
          necessary cookies, parts of the service (such as staying logged in) may stop working.
        </p>
      </LegalSection>

      <LegalSection heading="Consent">
        <p>
          Where required by law (for example in the UK/EU), we ask for your consent before setting
          non-essential cookies, and you can withdraw that consent at any time.
        </p>
      </LegalSection>

      <LegalSection heading="Contact">
        <p>
          Questions about cookies: {LEGAL_INFO.privacyEmail}.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
