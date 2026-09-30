import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { mockProvider } from "./mock";
import { getPaymentProvider } from "./index";
import { cashfreeProvider } from "./cashfree-provider";

const CF_TEST_SECRET = "cf_secret_for_tests";

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
  function sign(rawBody: string, timestamp: string, secret = CF_TEST_SECRET): string {
    return createHmac("sha256", secret).update(timestamp + rawBody).digest("base64");
  }

  it("accepts a correctly signed PAYMENT_SUCCESS event", async () => {
    const body = JSON.stringify({
      event: "PAYMENT_SUCCESS",
      event_id: "evt_123",
      event_data: { order: { order_id: "ord_abc123", order_status: "PAID" } },
    });
    const ts = "1617695238078";
    const event = await withSecret(async () =>
      cashfreeProvider.verifyWebhook(body, sign(body, ts), ts)
    );
    expect(event?.type).toBe("checkout.session.completed");
    expect(event?.id).toBe("evt_123");
    expect(event?.data.id).toBe("ord_abc123");
  });

  it("rejects a tampered body", async () => {
    const ts = "1617695238078";
    const original = JSON.stringify({ event: "PAYMENT_SUCCESS", event_id: "evt_1", event_data: {} });
    const tampered = JSON.stringify({ event: "PAYMENT_SUCCESS", event_id: "evt_2", event_data: {} });
    const event = await withSecret(() =>
      cashfreeProvider.verifyWebhook(tampered, sign(original, ts), ts)
    );
    expect(event).toBeNull();
  });

  it("rejects a wrong signature and a wrong timestamp", async () => {
    const body = JSON.stringify({ event: "PAYMENT_SUCCESS", event_id: "evt_3", event_data: {} });
    const ts = "1617695238078";
    const event = await withSecret(async () => ({
      badSig: await cashfreeProvider.verifyWebhook(body, "not-a-signature", ts),
      badTs: await cashfreeProvider.verifyWebhook(body, sign(body, ts), "999"),
      missing: await cashfreeProvider.verifyWebhook(body, "", ""),
    }));
    expect(event.badSig).toBeNull();
    expect(event.badTs).toBeNull();
    expect(event.missing).toBeNull();
  });

  it("maps failed payments to the expired event so pending orders are closed", async () => {
    const body = JSON.stringify({
      event: "PAYMENT_FAILED",
      event_id: "evt_4",
      event_data: { order: { order_id: "ord_fail", order_status: "FAILED" } },
    });
    const ts = "1617695238078";
    const event = await withSecret(() => cashfreeProvider.verifyWebhook(body, sign(body, ts), ts));
    expect(event?.type).toBe("checkout.session.expired");
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
