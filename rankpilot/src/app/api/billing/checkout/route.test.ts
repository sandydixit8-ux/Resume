import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Structural guards for the checkout endpoint.
 *
 * Checkout hands the browser over to Stripe's hosted page; most of its value is
 * in what it refuses to do when payments are not wired. Assert the guard rails
 * directly on the source, like the erasure route tests, so a future edit cannot
 * silently turn this into a free-plan grant or a fabricated URL.
 */
const source = readFileSync(resolve("src/app/api/billing/checkout/route.ts"), "utf8");

describe("POST /api/billing/checkout", () => {
  it("requires authentication and a billing permission", () => {
    expect(source).toMatch(/getSession\(\)/);
    expect(source).toMatch(/if \(!s\) return err\.auth\(\)/);
    expect(source).toMatch(/can\(s\.role, "billing:write"\)/);
    expect(source).toMatch(/if \(!can\(s\.role, "billing:write"\)\) return err\.forbidden\(\)/);
  });

  it("only offers paid plans — free is not a checkout target", () => {
    expect(source).toMatch(/z\.enum\(\["pro", "growth", "agency"\]\)/);
  });

  it("fails closed when Stripe is not configured", () => {
    expect(source).toMatch(/stripeConfig\(\)/);
    expect(source).toMatch(/if \("problem" in cfg\)/);
    expect(source).toMatch(/billing\.checkout_denied/);
  });

  it("delegates to Stripe's hosted URL — never fabricates a success page", () => {
    expect(source).toMatch(/createCheckoutSession\(/);
    expect(source).toMatch(/ok\(\{ url: session\.url, sessionId: session\.sessionId \}\)/);
    // Return URLs are absolute and site-derived; Stripe redirects the customer.
    expect(source).toMatch(/successUrl: absoluteUrl\(/);
    expect(source).toMatch(/cancelUrl: absoluteUrl\(/);
  });

  it("records every attempt and outcome in the audit log", () => {
    expect(source).toMatch(/billing\.checkout_created/);
    expect(source).toMatch(/billing\.checkout_failed/);
  });
});