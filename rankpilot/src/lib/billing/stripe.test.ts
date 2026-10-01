import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import {
  createCheckoutSession,
  parseStripeEvent,
  planForPriceId,
  priceIdForPlan,
  STRIPE_CHECKOUT_URL,
  stripeConfig,
  verifyWebhookSignature,
} from "./stripe";

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

function signedBody(body: object, secret: string, offsetSec = 0, extra?: string) {
  const raw = JSON.stringify(body);
  const t = Math.floor(Date.now() / 1000) + offsetSec;
  const v1 = createHmac("sha256", secret).update(`${t}.${raw}`).digest("hex");
  return { raw, header: `t=${t},${extra ? `${extra},` : ""}v1=${v1}` };
}

describe("stripeConfig", () => {
  it("returns config when both secrets and a price are set", () => {
    const r = stripeConfig(ENV);
    expect("config" in r).toBe(true);
  });

  it("fails closed when Stripe keys are missing", () => {
    const r = stripeConfig({});
    expect("problem" in r).toBe(true);
  });
});

describe("price mapping", () => {
  it("round-trips plan <-> price", () => {
    const c = config();
    expect(priceIdForPlan(c, "pro")).toBe("price_pro_1");
    expect(planForPriceId(c, "price_growth_1")).toBe("growth");
  });

  it("unknown price/plan map to nothing", () => {
    const c = config();
    expect(planForPriceId(c, "price_whatever")).toBeNull();
    expect(priceIdForPlan(c, "enterprise")).toBeNull();
  });
});

describe("verifyWebhookSignature", () => {
  const secret = ENV.STRIPE_WEBHOOK_SECRET;

  it("accepts a correctly signed body", () => {
    const { raw, header } = signedBody({ type: "x" }, secret);
    expect(verifyWebhookSignature(raw, header, secret)).toBe(true);
  });

  it("rejects a body whose signature does not match", () => {
    const { header } = signedBody({ type: "x" }, secret);
    expect(verifyWebhookSignature('{"type":"y"}', header, secret)).toBe(false);
  });

  it("rejects a signature generated with a different secret", () => {
    const { raw, header } = signedBody({ type: "x" }, "whsec_other");
    expect(verifyWebhookSignature(raw, header, secret)).toBe(false);
  });

  it("rejects an old (replayed) signature", () => {
    const { raw, header } = signedBody({ type: "x" }, secret, -60 * 60);
    expect(verifyWebhookSignature(raw, header, secret)).toBe(false);
  });

  it("rejects missing or malformed headers", () => {
    expect(verifyWebhookSignature("{}", "", secret)).toBe(false);
    expect(verifyWebhookSignature("{}", null, secret)).toBe(false);
    expect(verifyWebhookSignature("{}", "garbage", secret)).toBe(false);
    expect(verifyWebhookSignature("{}", "t=abc,v1=xyz", secret)).toBe(false);
  });

  it("handles multiple signatures and picks v1", () => {
    const { raw, header } = signedBody({ type: "x" }, secret, 0, "v1=fake,extra=1");
    expect(verifyWebhookSignature(raw, header, secret)).toBe(true);
  });
});

describe("parseStripeEvent", () => {
  it("parses a valid event", () => {
    const ev = parseStripeEvent(JSON.stringify({ id: "evt_1", type: "x", data: { object: {} } }));
    expect(ev).toBeTruthy();
    expect(ev?.type).toBe("x");
  });

  it("rejects junk", () => {
    expect(parseStripeEvent("not json")).toBeNull();
    expect(parseStripeEvent(JSON.stringify({ type: "x" }))).toBeNull();
  });
});

describe("createCheckoutSession", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn();
  });

  it("posts a subscription checkout and returns the hosted URL", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "cs_test_1", url: "https://checkout.stripe.com/c/pay/1" }), {
        status: 200,
      })
    );
    const result = await createCheckoutSession({
      config: config(),
      email: "a@example.com",
      orgName: "Acme",
      tenantId: "org_1",
      plan: "pro",
      successUrl: "https://rp.example/app/settings?billing=success",
      cancelUrl: "https://rp.example/app/settings?billing=cancelled",
      fetchFn: fetchMock,
    });
    expect(result).toEqual({ sessionId: "cs_test_1", url: "https://checkout.stripe.com/c/pay/1" });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(STRIPE_CHECKOUT_URL);
    const body = new URLSearchParams(init.body as string);
    expect(body.get("mode")).toBe("subscription");
    expect(body.get("line_items[0][price]")).toBe("price_pro_1");
    expect(body.get("client_reference_id")).toBe("org_1");
    expect(body.get("metadata[plan]")).toBe("pro");
    expect(body.get("subscription_data[metadata][tenant_id]")).toBe("org_1");
    const headers = new Headers(init.headers);
    expect(headers.get("authorization")).toContain("sk_test_abc");
  });

  it("throws when Stripe rejects (e.g. bad key / price)", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: "No such price" } }), { status: 400 })
    );
    await expect(
      createCheckoutSession({
        config: config(),
        email: "a@example.com",
        orgName: "Acme",
        tenantId: "org_1",
        plan: "growth",
        successUrl: "https://x/s",
        cancelUrl: "https://x/c",
        fetchFn: fetchMock,
      })
    ).rejects.toThrow(/No such price/);
  });

  it("throws for a plan with no configured price", async () => {
    await expect(
      createCheckoutSession({
        config: config(),
        email: "a@example.com",
        orgName: "Acme",
        tenantId: "org_1",
        plan: "free",
        successUrl: "https://x/s",
        cancelUrl: "https://x/c",
        fetchFn: fetchMock,
      })
    ).rejects.toThrow(/No Stripe price configured/);
  });
});