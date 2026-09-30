import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/get-session";
import { err, fail } from "@/lib/http";
import { run, row, nowIso } from "@/lib/db/db";
import { can } from "@/lib/auth/rbac";
import { PLANS, PLAN_PRICES } from "@/lib/plans";
import { getPaymentProvider } from "@/lib/payments";
import { applySubscription } from "@/lib/billing/subscriptions";
import { SITE_URL } from "@/lib/constants";
import { audit } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role as never, "billing:write")) return err.forbidden();

  const plan = (req.nextUrl.searchParams.get("plan") || "").toLowerCase();
  if (!PLANS[plan]) return err.validation({ plan: "Unknown plan" });

  const org = row("SELECT id, plan FROM organizations WHERE id = ?", s.org.id);
  if (!org) return err.notFound();

  const provider = getPaymentProvider();
  const cashfreeReady = provider.name === "cashfree" && provider.isConfigured();
  const stripeReady = provider.name === "stripe" && provider.isConfigured();

  if (stripeReady || cashfreeReady) {
    // Real recurring checkout — the webhook applies the plan on completion.
    // Cashfree bills domestically, so prefer the INR price when present.
    const prices = PLAN_PRICES[plan];
    const useInr = cashfreeReady && prices.inr > 0;
    const amountCents = (useInr ? prices.inr : prices.usd) * 100;
    try {
      const session = await provider.createSubscriptionSession({
        planKey: plan,
        planName: plan.charAt(0).toUpperCase() + plan.slice(1),
        amountCents,
        currency: useInr ? "inr" : "usd",
        successUrl: `${SITE_URL}/app/billing?upgraded=${plan}`,
        cancelUrl: `${SITE_URL}/app/billing`,
        customerEmail: s.user.email,
        metadata: { tenantId: s.org.id, plan },
      });
      audit({ tenantId: s.org.id, userId: s.user.id, action: "billing.checkout_session", resource: plan, ip: req.headers.get("x-forwarded-for") || undefined });
      return Response.redirect(new URL(session.url), 303);
    } catch {
      return err.server();
    }
  }

  // No provider keys: simulate in development, refuse in production.
  if (process.env.NODE_ENV === "production") {
    return fail("Billing is not configured. Contact support.", 503, "payments_not_configured");
  }

  run("UPDATE organizations SET plan = ?, updated_at = ? WHERE id = ?", plan, nowIso(), s.org.id);
  applySubscription({
    tenantId: s.org.id,
    plan,
    provider: "mock",
    providerId: null,
    status: "active",
  });
  audit({ tenantId: s.org.id, userId: s.user.id, action: "billing.plan_change", resource: plan, ip: req.headers.get("x-forwarded-for") || undefined });
  return Response.redirect(new URL("/app/billing?upgraded=" + plan, req.url), 303);
}