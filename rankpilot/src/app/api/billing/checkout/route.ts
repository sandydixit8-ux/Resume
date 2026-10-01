import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { can } from "@/lib/auth/rbac";
import { err, ok } from "@/lib/http";
import { row } from "@/lib/db/db";
import { stripeConfig, createCheckoutSession } from "@/lib/billing/stripe";
import { absoluteUrl } from "@/lib/site-url";
import { audit } from "@/lib/audit";
import { log } from "@/lib/logger";

const bodySchema = z.object({
  plan: z.enum(["pro", "growth", "agency"]),
});

/**
 * POST /api/billing/checkout — start a Stripe Checkout Session for a paid plan.
 *
 * Returns Stripe's hosted URL; the browser is redirected there entirely, so a
 * plan change only happens once Stripe has charged the customer and called our
 * webhook. When Stripe is not configured this answers 503 rather than inventing
 * a fake checkout, exactly like the other unconfigured-provider endpoints.
 */
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role, "billing:write")) return err.forbidden();

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return err.validation(parsed.error.issues);
  const { plan } = parsed.data;

  const org = row<{ name: string }>("SELECT name FROM organizations WHERE id = ?", s.org.id);
  if (!org) return err.notFound();

  const cfg = stripeConfig();
  if ("problem" in cfg) {
    audit({
      tenantId: s.org.id,
      userId: s.user.id,
      action: "billing.checkout_denied",
      entity: "organization",
      entityId: s.org.id,
      meta: { plan, reason: "stripe_not_configured" },
    });
    return err.quota("Paid checkout is not available: Stripe is not configured on this deployment.");
  }

  try {
    const session = await createCheckoutSession({
      config: cfg.config,
      email: s.user.email,
      orgName: org.name,
      tenantId: s.org.id,
      plan,
      successUrl: absoluteUrl("/app/settings?billing=success"),
      cancelUrl: absoluteUrl("/app/settings?billing=cancelled"),
    });
    audit({
      tenantId: s.org.id,
      userId: s.user.id,
      action: "billing.checkout_created",
      entity: "organization",
      entityId: s.org.id,
      meta: { plan, session: session.sessionId },
    });
    log.info("billing.checkout_created", {
      tenantId: s.org.id,
      userId: s.user.id,
      plan,
      sessionId: session.sessionId,
    });
    return ok({ url: session.url, sessionId: session.sessionId });
  } catch (e) {
    log.error("billing.checkout_failed", {
      tenantId: s.org.id,
      userId: s.user.id,
      plan,
      error: e instanceof Error ? e.message : String(e),
    });
    return err.server();
  }
}