import { all, row, run, newId, nowIso } from "@/lib/db/db";
import { audit } from "@/lib/audit";

export interface SubscriptionRow {
  id: string;
  tenant_id: string;
  provider: string;
  provider_id: string | null;
  customer_id: string | null;
  status: string;
  plan: string;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
}

export const ACTIVE_STATUSES = ["active", "trialing"] as const;

/**
 * Idempotent upsert of a subscription and apply its plan to the org.
 * Used by webhooks (checkout.session.completed, subscription.*) so a
 * re-delivered webhook never double-applies.
 */
export function applySubscription(input: {
  tenantId: string;
  plan: string;
  provider: string;
  providerId?: string | null;
  customerId?: string | null;
  status: string;
  currentPeriodEnd?: string | null;
}): SubscriptionRow | null {
  // A gateway can deliver events for tenants that were deleted while a mandate
  // was still active. Returning null keeps the webhook a 200 so the provider
  // stops retrying, instead of failing on the subscriptions foreign key.
  if (!row("SELECT id FROM organizations WHERE id = ?", input.tenantId)) {
    audit({
      action: "billing.subscription_orphan",
      resource: input.providerId || input.plan,
      meta: { provider: input.provider, tenantId: input.tenantId, status: input.status },
    });
    return null;
  }

  const existing = input.providerId
    ? row<SubscriptionRow>("SELECT * FROM subscriptions WHERE tenant_id = ? AND provider_id = ?", input.tenantId, input.providerId)
    : row<SubscriptionRow>("SELECT * FROM subscriptions WHERE tenant_id = ? AND plan = ? AND status != 'canceled'", input.tenantId, input.plan);

  let sub: SubscriptionRow | undefined = existing;
  if (existing) {
    run(
      `UPDATE subscriptions SET
         provider = ?, provider_id = ?, customer_id = ?,
         status = ?, plan = ?, current_period_end = ?, updated_at = ?
       WHERE id = ?`,
      input.provider,
      input.providerId ?? null,
      input.customerId ?? null,
      input.status,
      input.plan,
      input.currentPeriodEnd ?? existing.current_period_end,
      nowIso(),
      existing.id
    );
    sub = row<SubscriptionRow>("SELECT * FROM subscriptions WHERE id = ?", existing.id);
  } else {
    const id = newId("sub");
    run(
      `INSERT INTO subscriptions (id, tenant_id, provider, provider_id, customer_id, status, plan, current_period_end, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      input.tenantId,
      input.provider,
      input.providerId ?? null,
      input.customerId ?? null,
      input.status,
      input.plan,
      input.currentPeriodEnd ?? null,
      nowIso(),
      nowIso()
    );
    sub = row<SubscriptionRow>("SELECT * FROM subscriptions WHERE id = ?", id);
  }

  // Only grant the plan while the subscription is collectible.
  if (ACTIVE_STATUSES.includes(input.status as (typeof ACTIVE_STATUSES)[number])) {
    run("UPDATE organizations SET plan = ?, updated_at = ? WHERE id = ?", input.plan, nowIso(), input.tenantId);
    audit({ tenantId: input.tenantId, action: "billing.subscription_active", resource: input.plan, meta: { provider: input.provider, providerId: input.providerId } });
  } else {
    run("UPDATE organizations SET plan = 'free', updated_at = ? WHERE id = ?", nowIso(), input.tenantId);
    audit({ tenantId: input.tenantId, action: "billing.subscription_inactive", resource: input.plan, meta: { status: input.status } });
  }

  return sub!;
}

/** Cancel subscriptions under a tenant (by provider id when known) and drop status. */
export function cancelSubscriptionTracking(tenantId: string, providerId?: string | null) {
  if (providerId) {
    run(
      "UPDATE subscriptions SET status = 'canceled', updated_at = ? WHERE tenant_id = ? AND provider_id = ?",
      nowIso(),
      tenantId,
      providerId
    );
  } else {
    run(
      "UPDATE subscriptions SET status = 'canceled', updated_at = ? WHERE tenant_id = ? AND status IN ('active', 'trialing')",
      nowIso(),
      tenantId
    );
  }
  audit({ tenantId, action: "billing.subscription_canceled", resource: providerId ?? "" });
}

export function activeSubscription(tenantId: string): SubscriptionRow | undefined {
  return row<SubscriptionRow>(
    `SELECT * FROM subscriptions WHERE tenant_id = ? AND status IN ('active', 'trialing') ORDER BY created_at DESC LIMIT 1`,
    tenantId
  );
}

export function subscriptionsFor(tenantId: string): SubscriptionRow[] {
  return all<SubscriptionRow>("SELECT * FROM subscriptions WHERE tenant_id = ? ORDER BY created_at DESC", tenantId);
}