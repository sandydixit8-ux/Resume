import { describe, it, expect } from "vitest";
import { mockProvider } from "./mock";
import { getPaymentProvider } from "./index";

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
});
