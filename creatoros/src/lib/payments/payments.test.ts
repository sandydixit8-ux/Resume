import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { mockProvider } from "./mock";
import { getPaymentProvider } from "./index";
import { cashfreeProvider } from "./cashfree-provider";
import { planIdFor, subscriptionIdFor, normalisePhone as cfPhone } from "./cashfree-subscriptions";

const CF_TEST_SECRET = "cf_secret_for_tests";
const CF_TS = "1617695238078";

describe("payment provider abstraction", () => {
  it("mock provider creates a checkout session carrying the session id", async () => {
    const session = await mockProvider.createCheckoutSession({
      lines: [{ title: "Test", amountCents: 1000, quantity: 1 }],
      currency: "usd",
      successUrl: "http://localhost:3000/api/store/checkout/success?order=ord_1",
      cancelUrl: "http://localhost:3000/",
      metadata: { orderId: "ord_1" },
    });
    expect(session.sessionId.startsWith("cs_mock_")).toBe(true);
    expect(session.url).toContain("session_id=" + session.sessionId);
    expect(await mockProvider.getCheckoutPaymentStatus(session.sessionId)).toBe("paid");
  });

  it("mock webhook parser accepts valid events and rejects garbage", async () => {
    const good = await mockProvider.verifyWebhook(
      JSON.stringify({ id: "evt_1", type: "checkout.session.completed", data: { id: "cs_x" } }),
      ""
    );
    expect(good?.id).toBe("evt_1");

    expect(await mockProvider.verifyWebhook("not-json", "")).toBeNull();
    expect(await mockProvider.verifyWebhook(JSON.stringify({ foo: 1 }), "")).toBeNull();
  });

  it("factory falls back to mock outside production when stripe is unconfigured", () => {
    const prevKey = process.env.STRIPE_SECRET_KEY;
    const prevProvider = process.env.PAYMENT_PROVIDER;
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.PAYMENT_PROVIDER;
    try {
      const provider = getPaymentProvider();
      expect(provider.name).toBe("mock");
      expect(provider.isConfigured()).toBe(true);
    } finally {
      if (prevKey !== undefined) process.env.STRIPE_SECRET_KEY = prevKey;
      if (prevProvider !== undefined) process.env.PAYMENT_PROVIDER = prevProvider;
    }
  });

  it("factory picks cashfree when PAYMENT_PROVIDER=cashfree and keys exist", () => {
    const prev = {
      provider: process.env.PAYMENT_PROVIDER,
      id: process.env.CASHFREE_CLIENT_ID,
      secret: process.env.CASHFREE_SECRET_KEY,
    };
    process.env.PAYMENT_PROVIDER = "cashfree";
    process.env.CASHFREE_CLIENT_ID = "test_id";
    process.env.CASHFREE_SECRET_KEY = "test_secret";
    try {
      expect(getPaymentProvider().name).toBe("cashfree");
    } finally {
      restoreEnv("PAYMENT_PROVIDER", prev.provider);
      restoreEnv("CASHFREE_CLIENT_ID", prev.id);
      restoreEnv("CASHFREE_SECRET_KEY", prev.secret);
    }
  });
});


describe("cashfree webhook signature verification", () => {
  function sign(rawBody: string, timestamp: string): string {
    return createHmac("sha256", CF_TEST_SECRET).update(timestamp + rawBody).digest("base64");
  }

  it("accepts a correctly signed PAYMENT_SUCCESS event", async () => {
    const body = JSON.stringify({
      event: "PAYMENT_SUCCESS",
      event_id: "evt_123",
      event_data: { order: { order_id: "ord_abc123", order_status: "PAID" } },
    });
    const ts = CF_TS;
    const event = await withSecret(() => cashfreeProvider.verifyWebhook(body, sign(body, ts), ts));
    expect(event?.type).toBe("checkout.session.completed");
    expect(event?.id).toBe("evt_123");
    expect(event?.data.id).toBe("ord_abc123");
  });

  it("rejects a tampered body", async () => {
    const original = JSON.stringify({ event: "PAYMENT_SUCCESS", event_id: "evt_1", event_data: {} });
    const tampered = JSON.stringify({ event: "PAYMENT_SUCCESS", event_id: "evt_2", event_data: {} });
    const event = await withSecret(() => cashfreeProvider.verifyWebhook(tampered, sign(original, CF_TS), CF_TS));
    expect(event).toBeNull();
  });

  it("rejects a wrong signature, wrong timestamp and missing headers", async () => {
    const body = JSON.stringify({ event: "PAYMENT_SUCCESS", event_id: "evt_3", event_data: {} });
    const out = await withSecret(async () => ({
      badSig: await cashfreeProvider.verifyWebhook(body, "not-a-signature", CF_TS),
      badTs: await cashfreeProvider.verifyWebhook(body, sign(body, CF_TS), "999"),
      missing: await cashfreeProvider.verifyWebhook(body, "", ""),
    }));
    expect(out.badSig).toBeNull();
    expect(out.badTs).toBeNull();
    expect(out.missing).toBeNull();
  });

  it("maps failed payments to the expired event so pending orders are closed", async () => {
    const body = JSON.stringify({
      event: "PAYMENT_FAILED",
      event_id: "evt_4",
      event_data: { order: { order_id: "ord_fail", order_status: "FAILED" } },
    });
    const event = await withSecret(() => cashfreeProvider.verifyWebhook(body, sign(body, CF_TS), CF_TS));
    expect(event?.type).toBe("checkout.session.expired");
  });
});

describe("cashfree subscription webhooks", () => {
  function subEvent(subscription: Record<string, unknown>, eventId: string, event = "SUBSCRIPTION_STATUS_CHANGED") {
    const body = JSON.stringify({ event, event_id: eventId, event_data: { subscription } });
    const sig = createHmac("sha256", CF_TEST_SECRET).update(CF_TS + body).digest("base64");
    return { body, sig, ts: CF_TS };
  }

  function verify(subscription: Record<string, unknown>, eventId: string, event?: string) {
    const s = subEvent(subscription, eventId, event);
    return withSecret(() => cashfreeProvider.verifyWebhook(s.body, s.sig, s.ts));
  }

  it("carries subscription_tags through as metadata so tenants can be mapped", async () => {
    const event = await verify(
      {
        subscription_id: "sub_org1_creator_abc",
        subscription_status: "ACTIVE",
        next_schedule_date: "2026-10-30T09:00:00+05:30",
        customer_details: { customer_email: "buyer@example.com" },
        subscription_tags: { tenantId: "org1", plan: "creator" },
      },
      "sub_evt_1"
    );
    expect(event?.type).toBe("customer.subscription.updated");
    expect(event?.data.status).toBe("active");
    expect(event?.data.metadata).toEqual({ tenantId: "org1", plan: "creator" });
    expect(event?.data.subscription).toBe("sub_org1_creator_abc");
    expect(event?.data.currentPeriodEnd).toBe("2026-10-30T09:00:00+05:30");
  });

  it.each([
    ["CANCELLED", "customer.subscription.deleted", "canceled"],
    ["CUSTOMER_CANCELLED", "customer.subscription.deleted", "canceled"],
    ["EXPIRED", "customer.subscription.deleted", "canceled"],
    ["COMPLETED", "customer.subscription.deleted", "canceled"],
    ["LINK_EXPIRED", "customer.subscription.deleted", "canceled"],
    ["ON_HOLD", "customer.subscription.updated", "past_due"],
    ["ACTIVE", "customer.subscription.updated", "active"],
  ])("maps subscription status %s to %s/%s", async (cfStatus, expectedType, expectedStatus) => {
    const event = await verify(
      { subscription_id: "sub_x", subscription_status: cfStatus, subscription_tags: { tenantId: "t", plan: "pro" } },
      `sub_evt_${cfStatus}`
    );
    expect(event?.type).toBe(expectedType);
    expect(event?.data.status).toBe(expectedStatus);
  });

  it("flags a failed recurring charge as past_due instead of active", async () => {
    const event = await verify(
      { subscription_id: "sub_y", subscription_status: "ACTIVE", subscription_tags: { tenantId: "t", plan: "pro" } },
      "sub_evt_fail",
      "SUBSCRIPTION_PAYMENT_FAILED"
    );
    expect(event?.type).toBe("customer.subscription.updated");
    expect(event?.data.status).toBe("past_due");
  });

  it("never treats a subscription event as an order fulfilment", async () => {
    const event = await verify({ subscription_id: "sub_z", subscription_status: "ACTIVE" }, "sub_evt_guard");
    expect(event?.type).not.toBe("checkout.session.completed");
  });

  it("passes through subscription_tags even when empty", async () => {
    const event = await verify({ subscription_id: "sub_q", subscription_status: "ACTIVE" }, "sub_evt_empty");
    expect(event?.data.metadata).toEqual({});
  });
});

describe("cashfree subscription helpers", () => {
  it("builds plan ids that satisfy the Cashfree charset and length limit", () => {
    expect(planIdFor("creator")).toBe("creatoros_creator");
    expect(planIdFor("Weird Plan!!")).toBe("creatoros_weirdplan");
    expect(planIdFor("x".repeat(80)).length).toBeLessThanOrEqual(40);
  });

  it("builds unique subscription ids that carry tenant and plan", () => {
    const a = subscriptionIdFor("org1", "pro");
    const b = subscriptionIdFor("org1", "pro");
    expect(a).not.toBe(b);
    expect(a.startsWith("sub_org1_pro_")).toBe(true);
  });

  it("normalises Indian phone numbers and rejects unusable ones", () => {
    expect(cfPhone("9876543210")).toBe("9876543210");
    expect(cfPhone("+91 98765 43210")).toBe("9876543210");
    expect(cfPhone("09876543210")).toBe("9876543210");
    expect(cfPhone("12345")).toBeUndefined();
    expect(cfPhone(undefined)).toBeUndefined();
  });
});

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

async function withSecret<T>(fn: () => Promise<T>): Promise<T> {
  const prev = process.env.CASHFREE_SECRET_KEY;
  process.env.CASHFREE_SECRET_KEY = CF_TEST_SECRET;
  try {
    return await fn();
  } finally {
    restoreEnv("CASHFREE_SECRET_KEY", prev);
  }
}
