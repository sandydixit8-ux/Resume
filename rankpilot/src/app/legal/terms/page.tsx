import Link from "next/link";

export const metadata = {
  title: "Terms of Service — RankPilot AI",
  description: "The terms you agree to when using RankPilot AI.",
  alternates: { canonical: "/legal/terms" },
};

const UPDATED = "2026-09-26";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-ink-50">
      <header className="border-b border-ink-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold text-ink-900">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
              R
            </span>
            RankPilot AI
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/pricing" className="text-ink-600 hover:text-ink-900">
              Pricing
            </Link>
            <Link href="/login" className="text-ink-600 hover:text-ink-900">
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-3xl font-semibold text-ink-900">Terms of Service</h1>
        <p className="mt-1 text-sm text-ink-500">Last updated {UPDATED}</p>

        <div className="prose-rankpilot mt-8 space-y-6 text-sm leading-relaxed text-ink-700">
          <section>
            <h2 className="text-lg font-semibold text-ink-900">1. Agreement and the service</h2>
            <p>
              These terms govern your use of RankPilot AI (&quot;the Service&quot;), a software platform for SEO, AEO
              (answer-engine) and GEO (generative-engine) analysis, content planning, and social repurposing. By creating
              an account you accept them. If you are using the Service for an organization, you confirm you are
              authorized to bind that organization.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink-900">2. No ranking or traffic guarantees</h2>
            <p>
              The Service analyses the pages you point it at and reports what it observes. It does not control any
              search engine, AI answer engine, or social platform, and it makes no promise that using it will improve
              rankings, traffic, or revenue. Scores and priorities are diagnostics, not predictions. Nothing in the
              Service should be the sole basis of a business decision.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink-900">3. AI output is advisory and requires review</h2>
            <p>
              Generated content, recommendations, scripts, and analyses are produced by automated systems, including
              third-party AI models when configured. They can be wrong, incomplete, out of date, or biased. You are
              responsible for reviewing and editing anything before publishing it, and you are responsible for complying
              with the terms and policies of any platform you publish to. Content produced by the Service is a starting
              draft, not professional legal, medical, financial, or regulatory advice.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink-900">4. Your accounts, content, and permissions</h2>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                You are responsible for the accuracy of the information you submit, for the security of your credentials,
                and for all activity under your account. Notify the operator promptly if you suspect unauthorized use.
              </li>
              <li>
                You keep ownership of content you create and websites you submit. You grant the operator only the
                permissions needed to host, process, and display that content to you and to the other members of your
                workspace, including your own clients in agency mode.
              </li>
              <li>
                Roles control what each member can do (for example, analysts cannot change billing, and client logins
                are read-only). You are responsible for assigning roles correctly.
              </li>
              <li>
                You must not use the Service to violate law, to infringe others&apos; rights, to probe or attack
                third-party systems, or to crawl sites you are not authorized to crawl. The Service blocks requests to
                private and local network targets, and may refuse or terminate any activity it reasonably believes is
                abusive.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink-900">5. Plans, quotas, and billing</h2>
            <p>
              Each plan has published limits on websites, crawl depth, keywords, competitors, AI generations, and reports.
              Limits are enforced on the server and may be changed with notice; we will not reduce your limits
              mid-period in a way that removes functionality you have already paid for.
            </p>
            <p>
              <strong>Paid plans are not currently on sale.</strong> No payment provider is connected to the Service at
              this time, so there is nothing to charge you and no card details for you to enter. The prices shown on
              the pricing page are indicative of intended future pricing and are not an offer capable of
              acceptance. Until paid plans are enabled, a workspace can only be used on the free plan, and the
              Service cannot suspend a workspace for non-payment because it never takes payment. If you are granted
              access to a paid plan for evaluation, that access is a promotional grant which we may withdraw, and
              you can reduce your usage or leave at any time; reducing your plan does not delete your data.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink-900">6. Third-party services and integrations</h2>
            <p>
              Connecting a search console, analytics platform, CMS, or AI provider is optional and governed by that
              provider&apos;s own terms. The Service sends requests to those systems on your behalf using credentials you
              configure; you are responsible for what you authorize. Disconnecting an integration stops further requests
              from being made.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink-900">7. Availability and changes</h2>
            <p>
              The Service is provided on an &quot;as is&quot; and &quot;as available&quot; basis, without warranties of any
              kind. We may modify, suspend, or discontinue features. We will provide reasonable notice for material
              changes that reduce core functionality, and we may make urgent security changes without notice.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink-900">8. Limitation of liability</h2>
            <p>
              To the maximum extent permitted by law, the operator&apos;s total liability arising out of or relating to
              the Service is limited to the amount you paid for the Service in the twelve months before the claim. The
              operator is not liable for indirect, incidental, special, or consequential damages, or for lost profits,
              revenue, or data. Nothing here excludes liability that cannot be excluded by law.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink-900">9. Termination</h2>
            <p>
              You may stop using the Service and delete your account at any time. The operator may suspend or terminate
              access for material breach of these terms, non-payment, or legal or security necessity. On termination your
              data remains available for export for a reasonable period unless you ask us to delete it sooner or law
              requires us to keep it.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink-900">10. Changes to these terms</h2>
            <p>
              We may update these terms. Material changes will be announced in the product or by email, and the
              &quot;last updated&quot; date above will change. Continuing to use the Service after an update means you accept
              the revised terms.
            </p>
          </section>
        </div>

        <p className="mt-10 text-sm text-ink-500">
          <Link href="/legal/privacy" className="text-brand-700 hover:underline">
            Privacy Policy
          </Link>{" "}
          ·{" "}
          <Link href="/pricing" className="text-brand-700 hover:underline">
            Pricing
          </Link>
        </p>
      </main>
    </div>
  );
}
