/**
 * Applying Stripe lifecycle events to local plan state.
 *
 * The database is the source of truth for what a tenant is *permitted* to do
 * (plan-access checks read `organizations.plan`), so webhook events must round
 * back into it atomically. Two tables carry the state:
 *
 *   subscriptions   – the billing row (provider, provider_ref, status, plan)
 *   organizations   – the plan that gates feature access
 *
 * Both are updated in one transaction so a checknever observes half the story.
 * Event idempotency is delegated to the caller (the webhook route replays
 * `checkout.session.completed` at most once per session id), so the update
 * below is a single atomic write rather than a read-modify-write dance.
 */

import { nowIso, row, run, tx } from "@/lib/db/db";
import { planForPriceId } from "./stripe";
import type { StripeConfig, StripeEvent } from "./stripe";

export interface SubscriptionState {
  tenantId: string;
  plan: string | null;
  status: string;
  periodEnd: string | null;
  providerRef: string | null;
}

/**
 * Normalise Stripe's subscription status to the internal set. Free accounts
 * that never saw Stripe have no row, so this function is only about the shape
 * of a Stripe subscription's lifecycle.
 */
export function mapSubscriptionStatus(status: string): string {
  switch (status) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
      // Still have the service, on the hook for the next invoice attempt.
      return "past_due";
    case "unpaid":
      return "unpaid";
    case "paused":
      return "paused";
    case "canceled":
    case "incomplete_expired":
      return "canceled";
    default:
      // incomplete / incomplete_expired and anything unrecognised are not a
      // live subscription; fail toward "won't grant paid features".
      return "canceled";
  }
}

/**
 * True when the event should grant (or keep) paid access — the check the
 * webhook uses before it lets a subscription row drive `organizations.plan`.
 */
export function isPaidStatus(status: string): boolean {
  return status === "active" || status === "past_due";
}

/**
 * Resolve the *internal* plan an event claims, or null when it is a free
 * lifecycle (no subscription params) or references a price we do not map.
 *
 * The price on the subscription's line items is the source of truth for what
 * was actually charged, so it wins. Metadata falls back for events that carry
 * no items (checkout.session.completed echoes the session metadata we set).
 */
export function planClaimedByEvent(
  config: StripeConfig,
  event: StripeEvent
): { plan: string; priceId: string | null } | null {
  const priceId = priceIdGiven(event);
  if (priceId) {
    const plan = planForPriceId(config, priceId);
    if (plan) return { plan, priceId };
  }
  const object = event.data.object;
  const metaPlan =
    typeof object.metadata === "object" && object.metadata
      ? (object.metadata as Record<string, unknown>).plan
      : null;
  if (typeof metaPlan === "string" && metaPlan !== "free") {
    return { plan: metaPlan, priceId };
  }
  return null;
}

function priceIdGiven(event: StripeEvent): string | null {
  const object = event.data.object;
  const items = object.items;
  if (!Array.isArray(items) || items.length === 0) return null;
  const first = items[0] as Record<string, unknown>;
  const price = first.price as Record<string, unknown> | null;
  if (price && typeof price.id === "string") return price.id;
  return null;
}

export interface AppliedChange {
  tenantId: string;
  plan: string | null;
  status: string | null;
  providerRef: string | null;
}

/**
 * Apply a subscription-related event to local state. Returns the change (or
 * null when the event does not reference a tenant we care about), and throws
 * on an unknown organisational id — a webhook from Stripe that names a tenant
 * we have never issued is a serious signal, not something to swallow.
 */
export function applySubscriptionEvent(
  config: StripeConfig,
  event: StripeEvent,
  now = nowIso()
): AppliedChange | null {
  const type = event.type;
  if (type === "checkout.session.completed") {
    return applyCheckoutCompleted(config, event, now);
  }
  if (type === "customer.subscription.updated" || type === "customer.subscription.deleted") {
    return applySubscriptionLifecycle(config, event, now);
  }
  // Ignore events that carry no plan consequence (invoice.paid, charge updates,
  // payment_intent.succeeded, ...). They are acknowledged, nothing to apply.
  return null;
}

function applyCheckoutCompleted(
  config: StripeConfig,
  event: StripeEvent,
  now: string
): AppliedChange | null {
  const object = event.data.object as Record<string, unknown>;
  // Only subscription-mode checkouts matter; one-time payments must not be
  // translated into a plan.
  if (object.mode !== "subscription") return null;
  const status = typeof object.payment_status === "string" ? object.payment_status : null;
  if (status !== "paid") {
    // An unpaid checkout must never grant a plan. Acknowledge, don't apply.
    return null;
  }

  const tenantId =
    typeof object.client_reference_id === "string" ? object.client_reference_id : null;
  const providerRef = typeof object.subscription === "string" ? object.subscription : null;
  if (!tenantId) return null;
  const claim = planClaimedByEvent(config, { ...event });
  const plan = claim?.plan ?? null;
  // A checkout we cannot map to a plan (no metadata, no recognizable price)
  // must not grant anything — and in particular must not NULL an org's plan.
  if (!plan) return null;

  const org = row<{ id: string }>("SELECT id FROM organizations WHERE id = ?", tenantId);
  if (!org) throw new Error(`checkout.session.completed for unknown tenant ${tenantId}`);

  tx(() => {
    upsertSubscription(tenantId, { plan, status: "active", providerRef, periodEnd: null }, now);
    run("UPDATE organizations SET plan = ?, updated_at = ? WHERE id = ?", plan, now, tenantId);
  });
  return { tenantId, plan, status: "active", providerRef };
}

function applySubscriptionLifecycle(
  config: StripeConfig,
  event: StripeEvent,
  now: string
): AppliedChange | null {
  const object = event.data.object as Record<string, unknown>;
  const tenantId = typeof object.metadata === "object" && object.metadata
    ? (object.metadata as Record<string, unknown>).tenant_id
    : null;
  // Back-compat: checkout only sets metadata from v1; a subscription created
  // before that change has no tenant id in metadata.
  if (typeof tenantId !== "string" || !tenantId) {
    return fallbackTenantFromSubscription(config, object, now);
  }

  const rawStatus = typeof object.status === "string" ? object.status : "canceled";
  const status = mapSubscriptionStatus(rawStatus);
  const periodEnd =
    typeof object.current_period_end === "number"
      ? new Date(object.current_period_end * 1000).toISOString()
      : null;
  const claim = planClaimedByEvent(config, event);
  const plan = claim?.plan ?? null;

  const org = row<{ id: string }>("SELECT id FROM organizations WHERE id = ?", tenantId);
  if (!org) throw new Error(`${event.type} for unknown tenant ${tenantId}`);

  tx(() => {
    upsertSubscription(tenantId, { plan, status, providerRef: null, periodEnd }, now);
    // A real Stripe plan gates the org; an unrecognised/lifecycle-down plan
    // should not force-downgrade a row that is merely missing metadata, so we
    // only touch organizations.plan when we positively know what it should be.
    if (plan && isPaidStatus(status)) {
      run("UPDATE organizations SET plan = ?, updated_at = ? WHERE id = ?", plan, now, tenantId);
    }
    if (status === "canceled") {
      run("UPDATE organizations SET plan = 'free', updated_at = ? WHERE id = ?", now, tenantId);
    }
  });
  return { tenantId, plan, status, providerRef: null };
}

/**
 * A subscription-lifecycle event without tenant metadata is matched to a tenant
 * by its subscription id (stored as provider_ref at checkout). This is the
 * pre-metadata fallback; it must never re-enter `applySubscriptionLifecycle` or
 * it would loop on the same metadata-less object.
 */
function fallbackTenantFromSubscription(
  config: StripeConfig,
  object: Record<string, unknown>,
  now: string
): AppliedChange | null {
  const providerRef = typeof object.id === "string" ? object.id : null;
  if (!providerRef) return null;
  const sub = row<{ tenant_id: string }>(
    "SELECT tenant_id FROM subscriptions WHERE provider = 'stripe' AND provider_ref = ?",
    providerRef
  );
  if (!sub) return null;

  // Resolve the plan and status exactly as the metadata path does, then apply
  // to the tenant found via provider_ref. The event is symmetrical so reuse
  // the pure helpers directly.
  const rawStatus = typeof object.status === "string" ? object.status : "canceled";
  const status = mapSubscriptionStatus(rawStatus);
  const periodEnd =
    typeof object.current_period_end === "number"
      ? new Date(object.current_period_end * 1000).toISOString()
      : null;
  const priceId = priceIdGiven({ id: providerRef, type: "x", data: { object } });
  const plan = priceId ? planForPriceId(config, priceId) : null;

  const org = row<{ id: string }>("SELECT id FROM organizations WHERE id = ?", sub.tenant_id);
  if (!org) throw new Error(`subscription event for unknown tenant ${sub.tenant_id}`);

  tx(() => {
    upsertSubscription(sub.tenant_id, { plan, status, providerRef, periodEnd }, now);
    if (plan && isPaidStatus(status)) {
      run("UPDATE organizations SET plan = ?, updated_at = ? WHERE id = ?", plan, now, sub.tenant_id);
    }
    if (status === "canceled") {
      run("UPDATE organizations SET plan = 'free', updated_at = ? WHERE id = ?", now, sub.tenant_id);
    }
  });
  return { tenantId: sub.tenant_id, plan, status, providerRef };
}

function upsertSubscription(
  tenantId: string,
  state: { plan: string | null; status: string; providerRef: string | null; periodEnd: string | null },
  now: string
): void {
  const existing = row<{ id: string }>(
    "SELECT id FROM subscriptions WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 1",
    tenantId
  );
  if (existing) {
    run(
      "UPDATE subscriptions SET plan = COALESCE(?, plan), status = ?, provider = 'stripe', provider_ref = COALESCE(?, provider_ref), period_end = ?, updated_at = ? WHERE id = ?",
      state.plan,
      state.status,
      state.providerRef,
      state.periodEnd,
      now,
      existing.id
    );
    return;
  }
  run(
    "INSERT INTO subscriptions (id, tenant_id, plan, status, provider, provider_ref, period_end, created_at, updated_at) VALUES (?, ?, COALESCE(?, 'free'), ?, 'stripe', ?, ?, ?, ?)",
    `sub_stripe_${tenantId}`, // deterministic so replays collapse onto one row
    tenantId,
    state.plan,
    state.status,
    state.providerRef,
    state.periodEnd,
    now,
    now
  );
}