import { redirect } from "next/navigation";
import { Check, CreditCard, XCircle } from "lucide-react";
import { getSession } from "@/lib/auth/get-session";
import { row } from "@/lib/db/db";
import { getLimits, PLAN_PRICES } from "@/lib/plans";
import { allUsage } from "@/lib/usage";
import { activeSubscription } from "@/lib/billing/subscriptions";
import { paymentConfigured } from "@/lib/payments";

export const dynamic = "force-dynamic";

const PLAN_ORDER = ["free", "starter", "creator", "pro", "business"] as const;

export default async function BillingPage() {
  const s = await getSession();
  if (!s) redirect("/auth/login");

  const org = row<{ plan: string; name: string }>("SELECT plan, name FROM organizations WHERE id = ?", s.org.id);
  const currentPlan = org?.plan ?? "free";
  const usage = allUsage(s.org.id);
  const limits = getLimits(currentPlan);
  const sub = activeSubscription(s.org.id);
  const paymentsWired = paymentConfigured();
  const isMock = sub?.provider && sub.provider !== "stripe";

  const contactCount = (row("SELECT COUNT(*) AS c FROM contacts WHERE tenant_id = ?", s.org.id) as { c: number })?.c ?? 0;
  const pageCount = (row("SELECT COUNT(*) AS c FROM bio_pages WHERE tenant_id = ?", s.org.id) as { c: number })?.c ?? 0;
  const serviceCount = (row("SELECT COUNT(*) AS c FROM services WHERE tenant_id = ?", s.org.id) as { c: number })?.c ?? 0;
  const productCount = (row("SELECT COUNT(*) AS c FROM products WHERE tenant_id = ?", s.org.id) as { c: number })?.c ?? 0;
  const courseCount = (row("SELECT COUNT(*) AS c FROM courses WHERE tenant_id = ?", s.org.id) as { c: number })?.c ?? 0;

  const meters = [
    { label: "Bio pages", used: pageCount, limit: limits.bioPages },
    { label: "Contacts", used: Math.max(contactCount, usage.contacts || 0), limit: limits.contacts },
    { label: "Bookings services", used: serviceCount, limit: limits.services },
    { label: "Products", used: productCount, limit: limits.products },
    { label: "Courses", used: courseCount, limit: limits.courses },
    { label: "AI credits", used: usage.aiCredits || 0, limit: limits.aiCredits },
    { label: "Emails sent", used: usage.emails || 0, limit: limits.emailsPerMonth },
    { label: "Views / month", used: usage.viewsPerMonth || 0, limit: limits.viewsPerMonth },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-950">Billing &amp; plan</h1>
        <p className="mt-1 text-sm text-navy-500">You&apos;re on the <span className="font-medium capitalize text-navy-900">{currentPlan}</span> plan.</p>
      </div>

      {sub && (
        <div className={`card flex flex-wrap items-center justify-between gap-4 p-5 ${isMock ? "border-amber-200 bg-amber-50/50" : "border-emerald-200 bg-emerald-50/50"}`}>
          <div className="flex items-center gap-3">
            <CreditCard className="h-6 w-6 text-navy-400" />
            <div>
              <div className="font-semibold capitalize text-navy-900">{sub.plan} plan · {sub.status}</div>
              <div className="text-xs text-navy-500">
                via {sub.provider}
                {sub.current_period_end && <> · renewed {sub.current_period_end.slice(0, 10)}</>}
                {isMock && <> · simulated (no Stripe keys)</>}
              </div>
            </div>
          </div>
          <form method="POST" action="/api/billing/cancel">
            <button type="submit" className="btn-secondary !py-2 text-sm text-red-600">
              <XCircle className="h-4 w-4" /> Cancel subscription
            </button>
          </form>
        </div>
      )}

      <div className="card p-6">
        <h2 className="mb-4 font-semibold text-navy-900">Usage this month</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {meters.map((m) => {
            const pct = m.limit === -1 ? 0 : Math.min(100, Math.round((m.used / Math.max(1, m.limit)) * 100));
            const nearly = m.limit !== -1 && pct >= 80;
            return (
              <div key={m.label} className="rounded-xl border border-navy-100 p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-navy-700">{m.label}</span>
                  <span className="text-navy-400">
                    {m.used}{m.limit !== -1 ? ` / ${m.limit}` : " / ∞"}
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-navy-100">
                  <div
                    className={`h-full rounded-full ${nearly ? "bg-amber-500" : "bg-brand-500"}`}
                    style={{ width: `${m.limit === -1 ? 0 : pct}%` }}
                  />
                </div>
                {nearly && <p className="mt-1 text-xs text-amber-600">Upgrade for headroom</p>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {PLAN_ORDER.map((key) => {
          const p = getLimits(key);
          const active = key === currentPlan;
          const price = PLAN_PRICES[key];
          return (
            <div key={key} className={`card flex flex-col p-5 ${active ? "border-brand-400 ring-1 ring-brand-300" : ""}`}>
              <div className="flex items-center justify-between">
                <h3 className="font-bold capitalize text-navy-900">{key}</h3>
                {active && <span className="rounded-full bg-brand-600 px-2 py-0.5 text-xs font-medium text-white">Current</span>}
              </div>
              <div className="mt-2 text-xl font-bold text-navy-950">
                ${price.usd}
                <span className="text-xs font-medium text-navy-400">/mo</span>
              </div>
              <ul className="mt-4 flex-1 space-y-2 text-sm text-navy-600">
                <li className="flex items-start gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-500" /> {f(p.bioPages)} bio pages</li>
                <li className="flex items-start gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-500" /> {f(p.links)} links</li>
                <li className="flex items-start gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-500" /> {f(p.contacts)} contacts</li>
                <li className="flex items-start gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-500" /> {f(p.services)} booking services</li>
                {p.customDomain && <li className="flex items-start gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-500" /> Custom domain</li>}
                {p.emailAutomation && <li className="flex items-start gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-500" /> Email automation</li>}
              </ul>
              {!active && (
                <a href={`/api/billing/checkout?plan=${key}`} className="btn-secondary mt-5 w-full">
                  Upgrade
                </a>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-center text-xs text-navy-400">
        {paymentsWired
          ? "Plan upgrades are billed through the payment provider and applied via webhook."
          : "Billing activates once payment provider keys are set. Upgrades are simulated for development until then."}
      </p>
    </div>
  );
}

function f(n: number): string {
  return n === -1 ? "Unlimited" : String(n);
}