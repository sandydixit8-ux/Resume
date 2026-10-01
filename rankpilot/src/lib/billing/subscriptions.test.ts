import { beforeEach, describe, expect, it } from "vitest";
import { getDb, newId, nowIso, run } from "@/lib/db/db";
import { stripeConfig } from "./stripe";
import { applySubscriptionEvent, isPaidStatus, mapSubscriptionStatus } from "./subscriptions";

const ENV = {
  STRIPE_SECRET_KEY: "sk_test_abc",
  STRIPE_WEBHOOK_SECRET: "whsec_1234567890",
  STRIPE_PRICE_PRO: "price_pro_1",
  STRIPE_PRICE_GROWTH: "price_growth_1",
  STRIPE_PRICE_AGENCY: "price_agency_1",
};

function config() {
  const r = stripeConfig(ENV);
  if ("problem" in r) throw new Error(r.problem);
  return r.config;
}

function makeTenant(plan = "free") {
  const orgId = newId("org");
  run(
    "INSERT INTO organizations (id, name, slug, plan, mode, created_at, updated_at) VALUES (?, ?, ?, ?, 'individual', ?, ?)",
    orgId,
    "Acme",
    `slug-${orgId}`,
    plan,
    nowIso(),
    nowIso()
  );
  return orgId;
}

function event(type: string, object: Record<string, unknown>) {
  return { id: `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`, type, data: { object } };
}

describe("mapSubscriptionStatus / isPaidStatus", () => {
  it("treats active and trialing as paid, others as not", () => {
    expect(isPaidStatus(mapSubscriptionStatus("active"))).toBe(true);
    expect(isPaidStatus(mapSubscriptionStatus("trialing"))).toBe(true);
    expect(isPaidStatus(mapSubscriptionStatus("past_due"))).toBe(true);
    expect(isPaidStatus(mapSubscriptionStatus("canceled"))).toBe(false);
    expect(isPaidStatus(mapSubscriptionStatus("unpaid"))).toBe(false);
    expect(isPaidStatus(mapSubscriptionStatus("incomplete"))).toBe(false);
  });
});

describe("applySubscriptionEvent", () => {
  beforeEach(() => {
    run("DELETE FROM subscriptions");
    run("DELETE FROM organizations");
  });

  it("grants the paid plan on checkout.session.completed", () => {
    const orgId = makeTenant();
    const change = applySubscriptionEvent(
      config(),
      event("checkout.session.completed", {
        id: "cs_1",
        mode: "subscription",
        payment_status: "paid",
        client_reference_id: orgId,
        subscription: "sub_1",
        metadata: { plan: "pro", tenant_id: orgId },
      }),
      nowIso()
    );
    expect(change).toEqual({ tenantId: orgId, plan: "pro", status: "active", providerRef: "sub_1" });
    const org = getDb().prepare("SELECT plan FROM organizations WHERE id = ?").get(orgId) as {
      plan: string;
    };
    expect(org.plan).toBe("pro");
    const sub = getDb().prepare("SELECT plan, status, provider_ref FROM subscriptions WHERE tenant_id = ?").get(orgId) as {
      plan: string;
      status: string;
      provider_ref: string | null;
    };
    expect(sub).toEqual({ plan: "pro", status: "active", provider_ref: "sub_1" });
  });

  it("applies the plan from a subscription.updated price item", () => {
    const orgId = makeTenant();
    const change = applySubscriptionEvent(
      config(),
      event("customer.subscription.updated", {
        id: "sub_1",
        status: "active",
        current_period_end: Math.floor(Date.now() / 1000) + 86400,
        metadata: { tenant_id: orgId, plan: "growth" },
        items: { data: [{ price: { id: "price_growth_1" } }] },
      }),
      nowIso()
    );
    expect(change).toEqual({ tenantId: orgId, plan: "growth", status: "active", providerRef: null });
    const org = getDb().prepare("SELECT plan FROM organizations WHERE id = ?").get(orgId) as {
      plan: string;
    };
    expect(org.plan).toBe("growth");
    const sub = getDb().prepare("SELECT plan, status FROM subscriptions WHERE tenant_id = ?").get(orgId) as {
      plan: string;
      status: string;
    };
    expect(sub).toEqual({ plan: "growth", status: "active" });
  });

  it("downgrades to free on cancellation", () => {
    const orgId = makeTenant("growth");
    applySubscriptionEvent(
      config(),
      event("customer.subscription.updated", {
        id: "sub_1",
        status: "canceled",
        metadata: { tenant_id: orgId },
        items: { data: [] },
      }),
      nowIso()
    );
    const org = getDb().prepare("SELECT plan FROM organizations WHERE id = ?").get(orgId) as {
      plan: string;
    };
    expect(org.plan).toBe("free");
  });

  it("ignores one-time checkouts (no subscription mode)", () => {
    const orgId = makeTenant();
    const change = applySubscriptionEvent(
      config(),
      event("checkout.session.completed", {
        id: "cs_payment",
        mode: "payment",
        payment_status: "paid",
        client_reference_id: orgId,
      }),
      nowIso()
    );
    expect(change).toBeNull();
    const org = getDb().prepare("SELECT plan FROM organizations WHERE id = ?").get(orgId) as {
      plan: string;
    };
    expect(org.plan).toBe("free");
  });

  it("ignores events with no plan consequence (invoice.paid)", () => {
    const change = applySubscriptionEvent(
      config(),
      event("invoice.paid", { id: "in_1" }),
      nowIso()
    );
    expect(change).toBeNull();
  });

  it("throws on an unknown tenant — a desync signal, not a silent drop", () => {
    expect(() =>
      applySubscriptionEvent(
        config(),
        event("customer.subscription.updated", {
          id: "sub_1",
          status: "active",
          metadata: { tenant_id: "org_does_not_exist" },
        }),
        nowIso()
      )
    ).toThrow();
  });
});