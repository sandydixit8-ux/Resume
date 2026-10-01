import Link from "next/link";
import { PLAN_PRICES, PLANS } from "@/lib/plans";

export const metadata = {
  title: "Pricing — RankPilot AI",
  description:
    "Transparent plans. Every paid plan includes the full audit, Growth Score, Content Studio and Action Center. No ranking guarantees.",
  alternates: { canonical: "/pricing" },
};

const ORDER = ["free", "pro", "growth", "agency"] as const;

const BLURB: Record<string, string> = {
  free: "Run your first audit and see the whole loop.",
  pro: "For a single site that needs ongoing work.",
  growth: "Multi-site, multi-channel growth team.",
  agency: "Client workspaces, white-label reports, unlimited keywords.",
};

function fmt(limit: number): string {
  if (limit === -1) return "Unlimited";
  return limit.toLocaleString("en-US");
}

const ROWS: Array<{ key: keyof (typeof PLANS)["free"]; label: string }> = [
  { key: "websites", label: "Websites" },
  { key: "pagesPerCrawl", label: "Pages per crawl" },
  { key: "keywords", label: "Tracked keywords" },
  { key: "competitors", label: "Competitors" },
  { key: "aiGenerations", label: "AI generations / month" },
  { key: "socialGenerations", label: "Social generations / month" },
  { key: "reports", label: "Reports / month" },
];

export default function PricingPage() {
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
            <Link href="/free-seo-audit" className="text-ink-600 hover:text-ink-900">
              Free audit
            </Link>
            <Link href="/login" className="text-ink-600 hover:text-ink-900">
              Sign in
            </Link>
            <Link href="/register" className="btn-primary">
              Start free
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-12">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-semibold text-ink-900">Pricing that matches the work, not the hype</h1>
          <p className="mt-3 text-ink-600">
            Every plan runs the same audit engine and the same Growth Score. Paid plans add capacity, competitor
            intelligence, and the growth surfaces. We never sell ranking guarantees — we sell observed data, transparent
            scoring, and AI that tells you when it doesn&apos;t have the data.
          </p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {ORDER.map((plan) => {
            const price = PLAN_PRICES[plan].usd;
            const limits = PLANS[plan];
            const featured = plan === "growth";
            return (
              <div
                key={plan}
                className={
                  featured
                    ? "flex flex-col rounded-2xl border-2 border-brand-600 bg-white p-6 shadow-soft"
                    : "flex flex-col rounded-2xl border border-ink-200 bg-white p-6"
                }
              >
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold capitalize text-ink-900">{plan}</h2>
                  {featured ? (
                    <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700">
                      Most popular
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-ink-500">{BLURB[plan]}</p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-3xl font-semibold text-ink-900">${price}</span>
                  <span className="text-sm text-ink-400">/month</span>
                </div>
                <Link
                  href="/register"
                  className={featured ? "btn-primary mt-4 w-full" : "btn-secondary mt-4 w-full"}
                >
                  {price === 0 ? "Start free" : `Choose ${plan}`}
                </Link>
                <dl className="mt-5 space-y-2 text-sm">
                  {ROWS.map((r) => (
                    <div key={r.key} className="flex items-center justify-between gap-2">
                      <dt className="text-ink-500">{r.label}</dt>
                      <dd className="font-medium text-ink-800">{fmt(limits[r.key])}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            );
          })}
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-ink-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-ink-900">What every plan includes</h3>
            <ul className="mt-2 space-y-1.5 text-sm text-ink-600">
              <li>Full crawl, technical + on-page + AEO + GEO audit</li>
              <li>Explainable Growth Score with stored methodology</li>
              <li>Action Center with prioritised, evidence-backed actions</li>
              <li>Content Studio and social generation (quota applies)</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-ink-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-ink-900">How AI is billed</h3>
            <p className="mt-2 text-sm text-ink-600">
              AI generations draw on your monthly quota. Every call is metered with model, prompt version and source.
              Without an AI provider configured, RankPilot falls back to deterministic rules and tells you so — your
              quota isn&apos;t spent.
            </p>
          </div>
          <div className="rounded-2xl border border-ink-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-ink-900">What we don&apos;t promise</h3>
            <p className="mt-2 text-sm text-ink-600">
              No ranking guarantees, no traffic forecasts, no &quot;10× growth&quot; claims. We show observed data, label
              AI interpretation as such, and print &quot;Data unavailable&quot; when a metric hasn&apos;t been measured.
            </p>
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-ink-400">
          Plan limits are enforced server-side on every request. A crawl also stops at the server&apos;s own crawl
          ceiling to protect your site, and the request tells you the page budget it actually used. See{" "}
          <Link href="/legal/terms" className="text-brand-700 hover:underline">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/legal/privacy" className="text-brand-700 hover:underline">
            Privacy
          </Link>
          .
        </p>
      </main>
    </div>
  );
}
