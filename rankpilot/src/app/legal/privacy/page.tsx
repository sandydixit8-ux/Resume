import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — RankPilot AI",
  description: "What RankPilot AI stores, why, and who can see it.",
  alternates: { canonical: "/legal/privacy" },
};

const UPDATED = "2026-09-26";

export default function PrivacyPage() {
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
        <h1 className="text-3xl font-semibold text-ink-900">Privacy Policy</h1>
        <p className="mt-1 text-sm text-ink-500">Last updated {UPDATED}</p>

        <div className="prose-rankpilot mt-8 space-y-6 text-sm leading-relaxed text-ink-700">
          <section>
            <h2 className="text-lg font-semibold text-ink-900">1. The short version</h2>
            <p>
              RankPilot AI stores the data needed to run your account: your identity, the websites you add, and the
              crawl and analysis results we compute for you. We do not sell your data, we do not build advertising
              profiles, and we do not share your workspace with other customers. The AI provider is optional and, when
              you configure one, it only ever receives the context needed for the specific task you triggered.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink-900">2. What we store</h2>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <strong>Account data</strong> — name, email, password hash, organization, role, and plan. Passwords are
                stored only as salted hashes.
              </li>
              <li>
                <strong>Session data</strong> — a hashed session token with expiry, plus the IP address and user agent
                used at sign-in, so you can recognise and revoke your own sessions.
              </li>
              <li>
                <strong>Workspace data</strong> — websites you add, crawl runs, fetched page extracts, issues, scores,
                keywords, questions, topics, actions, content drafts, social campaigns, reports, experiments, and
                recorded revenue events.
              </li>
              <li>
                <strong>Usage and audit data</strong> — AI task, model, prompt version, token counts, cost, duration and
                outcome per call; quota counters per plan period; and an audit log of consequential actions with the
                acting user and timestamp.
              </li>
              <li>
                <strong>Free audit data</strong> — the submitted URL, an optional email, the request IP, and a limited
                score snapshot. Free audits are not attached to any account.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink-900">3. What we do not store</h2>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <strong>No integration credentials in the database.</strong> Search-console, analytics and CMS
                credentials are read from server environment variables, so a database export never contains them.
              </li>
              <li>
                <strong>No page content beyond what the crawl needs.</strong> We keep a text sample and extracted
                structure for analysis, not a full mirror of your site.
              </li>
              <li>
                <strong>No invented metrics.</strong> Values we have not measured are stored as <code>null</code> and
                shown as &quot;Data unavailable&quot;. Absence of data is never recorded as a zero, a miss, or a
                ranking.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink-900">4. Who processes your data</h2>
            <p>
              RankPilot is designed to be self-hosted, so the primary processor of your data is whoever operates the
              instance you connect to — often your own infrastructure. Two categories of third parties can be involved,
              and both are opt-in:
            </p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <strong>Your AI provider</strong> (for example OpenAI or Anthropic), used only when an API key is
                configured. Without a key, tasks run on our deterministic rules engine and no content leaves your
                instance. Every request records the model used in <code>ai_usage</code>.
              </li>
              <li>
                <strong>Your infrastructure providers</strong> — hosting, SMTP, and any payment provider you connect
                yourself.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink-900">5. Legal bases, retention and your rights</h2>
            <p>
              We process account and workspace data to perform the service you signed up for. Session IPs,
              free-audit IPs and audit-log entries are retained for security and abuse prevention. Free-audit snapshots
              are retained only as long as needed to serve the lookup.
            </p>
            <p>
              Deleting a website or a content item is a <strong>logical</strong> delete: the row is hidden from the app
              but retained so that existing reports and audit history stay coherent. This build has no automatic
              retention job and no self-service hard delete, so ask the operator of your instance to remove data
              permanently. Until it is removed from the database, it is not shown to anyone in the product.
            </p>
            <p>
              Depending on where you live, you may have rights to access, correct, export, or delete your personal data,
              and to object to or restrict certain processing. Because the instance is operated by the party you
              contracted with, send requests to that operator; a self-hosted instance&apos;s data never leaves it.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink-900">6. Security</h2>
            <p>
              Authentication uses hashed passwords and revocable, hashed session tokens. Every database query in an
              authenticated route is scoped to your organization, and that isolation is covered by automated tests.
              Outbound crawls block private and local network targets. Still, no system is perfect: report to the
              operator of your instance if you find a weakness rather than disclosing it publicly first.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink-900">7. Children</h2>
            <p>
              The service is not directed at children under 13, and we do not knowingly collect their data.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-ink-900">8. Contact</h2>
            <p>
              Questions about this policy can go to the operator of your instance. For self-hosted deployments, the
              support email configured in workspace branding is the right contact.
            </p>
          </section>
        </div>

        <p className="mt-10 text-sm text-ink-500">
          <Link href="/legal/terms" className="text-brand-700 hover:underline">
            Terms of Service
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
