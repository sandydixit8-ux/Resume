/**
 * Stripe billing integration.
 *
 * Real provider contracts only — nothing here pretends a payment happened or
 * invents webhook events. Two capabilities ship:
 *
 *   1. Checkout: create a Stripe Checkout Session over a subscription price,
 *      returning Stripe's hosted checkout URL. The customer is redirected to
 *      Stripe, pays, and Stripe calls our webhook.
 *
 *   2. Webhook: verify the `stripe-signature` header the way Stripe specifies
 *      (HMAC-SHA256 over `t=<epoch>.` + the raw body, against
 *      `STRIPE_WEBHOOK_SECRET`), then apply the lifecycle events that matter
 *      for plan state: `checkout.session.completed`,
 *      `customer.subscription.updated` and `customer.subscription.deleted`.
 *
 * The two secrets are separate obligations: the API key makes outbound calls,
 * the webhook secret authenticates inbound event claims. A deployment that
 * forgets either fails closed (503 / explicit reason), never guesses.
 *
 * Plan → price mapping is configuration, not code: `STRIPE_PRICE_PRO`,
 * `STRIPE_PRICE_GROWTH` and `STRIPE_PRICE_AGENCY` hold the Stripe price IDs.
 * The webhook resolves a subscription's plan from the price on its line items,
 * so a plan change ordered inside Stripe rounds back to us correctly.
 */

import { createHmac } from "node:crypto";

export const STRIPE_CHECKOUT_URL = "https://api.stripe.com/v1/checkout/sessions";

export interface StripeConfig {
  secretKey: string;
  webhookSecret: string;
  /** price.id -> internal plan */
  priceToPlan: ReadonlyMap<string, string>;
}

const PLANS_WITH_PRICES = ["pro", "growth", "agency"] as const;

/**
 * Build the active Stripe config, or null (plus a human reason) when the
 * deployment is not wired for payments. Fails closed: no secret, no Stripe.
 */
export function stripeConfig(
  env: Record<string, string | undefined> = process.env
): { config: StripeConfig } | { problem: string } {
  const secretKey = env.STRIPE_SECRET_KEY?.trim();
  const webhookSecret = env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secretKey || !webhookSecret) {
    return {
      problem:
        "STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET are not set, so paid plans cannot be purchased and webhook events are not accepted",
    };
  }
  const priceToPlan = new Map<string, string>();
  for (const plan of PLANS_WITH_PRICES) {
    const price = env[`STRIPE_PRICE_${plan.toUpperCase()}`]?.trim();
    if (price) priceToPlan.set(price, plan);
  }
  return { config: { secretKey, webhookSecret, priceToPlan } };
}

export interface CheckoutOptions {
  config: StripeConfig;
  /** Customer's invoice email, passed through to Stripe. */
  email: string;
  /** Who is paying — the Stripe customer-facing name. */
  orgName: string;
  /** Organisation that receives the plan when the payment lands. */
  tenantId: string;
  plan: string;
  /** Absolute return URLs after payment completes or is abandoned. */
  successUrl: string;
  cancelUrl: string;
  fetchFn?: typeof fetch;
}

export interface CheckoutResult {
  sessionId: string;
  url: string;
}

/**
 * Create a Stripe Checkout Session (mode = subscription). Throws on transport
 * errors and on Stripe errors; returns the session id + hosted URL on success.
 */
export async function createCheckoutSession(
  options: CheckoutOptions
): Promise<CheckoutResult> {
  const priceId = priceIdForPlan(options.config, options.plan);
  if (!priceId) {
    throw new Error(
      `No Stripe price configured for plan "${options.plan}". Set STRIPE_PRICE_${options.plan.toUpperCase()}.`
    );
  }
  const f = options.fetchFn ?? fetch;
  const body = new URLSearchParams({
    mode: "subscription",
    "line_items[0][price]": priceId,
    "line_items[0][quantity]": "1",
    success_url: options.successUrl,
    cancel_url: options.cancelUrl,
    client_reference_id: options.tenantId,
    customer_email: options.email,
    // Session metadata: echoed back on checkout.session.completed.
    "metadata[plan]": options.plan,
    "metadata[tenant_id]": options.tenantId,
    // Subscription metadata: echoed back on customer.subscription.updated and
    // customer.subscription.deleted, which carry no client_reference_id.
    "subscription_data[metadata][plan]": options.plan,
    "subscription_data[metadata][tenant_id]": options.tenantId,
  });
  const res = await f(STRIPE_CHECKOUT_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${options.config.secretKey}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
    redirect: "error",
  });
  const data = (await res.json().catch(() => null)) as
    | { id?: string; url?: string; error?: { message?: string } }
    | null;
  if (!res.ok || !data?.id || !data?.url) {
    throw new Error(
      `Stripe checkout request failed (${res.status}): ${data?.error?.message ?? "no session returned"}`
    );
  }
  return { sessionId: data.id, url: data.url };
}

export function priceIdForPlan(
  config: StripeConfig,
  plan: string
): string | null {
  for (const [price, mapped] of config.priceToPlan) {
    if (mapped === plan) return price;
  }
  return null;
}

export function planForPriceId(config: StripeConfig, priceId: string): string | null {
  return config.priceToPlan.get(priceId) ?? null;
}

export interface StripeEvent {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
}

/**
 * Verify a Stripe webhook signature.
 *
 * Stripe sends `Stripe-Signature: t=<epoch>,v1=<hex hmac>`. HMAC is over
 * `${t}.${rawBody}` with the webhook secret; comparison is constant-time. The
 * timestamp clause also bounds replay: a captured request with an old `t` is
 * rejected. Returns null on any mismatch; throws only if Stripe's header shape
 * is malformed in a way that must never be silently accepted.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  webhookSecret: string,
  nowMs = Date.now(),
  toleranceMs = 5 * 60 * 1000
): boolean {
  if (!signatureHeader) return false;
  // Stripe can send multiple signatures; only v1 is current and we require it.
  const parts = new Map<string, string>();
  for (const chunk of signatureHeader.split(",")) {
    const eq = chunk.indexOf("=");
    if (eq === -1) continue;
    parts.set(chunk.slice(0, eq), chunk.slice(eq + 1));
  }
  const t = parts.get("t");
  const v1 = parts.get("v1");
  if (!t || !v1) return false;
  const ts = Number(t);
  if (!Number.isFinite(ts)) return false;
  // Reject anything older or further ahead than the tolerance; a bounded window
  // is what Stripe's own libraries enforce and stops replay of old captures.
  if (Math.abs(nowMs - ts * 1000) > toleranceMs) return false;

  const expected = createHmac("sha256", webhookSecret).update(`${t}.${rawBody}`).digest();
  let provided: Buffer;
  try {
    provided = Buffer.from(v1, "hex");
  } catch {
    return false;
  }
  if (expected.length !== provided.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) mismatch |= expected[i] ^ provided[i];
  return mismatch === 0;
}

/** Parse a webhook JSON payload; fails closed on anything unusable. */
export function parseStripeEvent(rawBody: string): StripeEvent | null {
  try {
    const parsed = JSON.parse(rawBody) as {
      id: string;
      type: string;
      data: { object: Record<string, unknown> };
    };
    if (typeof parsed.id !== "string" || typeof parsed.type !== "string" || !parsed?.data?.object) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}