import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import { POST as webhookPost } from "./route";
import { getDb, newId, nowIso, run } from "@/lib/db/db";

const ORIG_ENV = { ...process.env };
const SECRET = "whsec_live_1234567890abcdef";

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

function sign(raw: string, offsetSec = 0) {
  const t = Math.floor(Date.now() / 1000) + offsetSec;
  const v1 = createHmac("sha256", SECRET).update(`${t}.${raw}`).digest("hex");
  return `t=${t},v1=${v1}`;
}

function post(raw: string, header: string | null) {
  return webhookPost(
    new NextRequest("http://localhost/api/billing/webhook", {
      method: "POST",
      body: raw,
      headers: header ? { "stripe-signature": header } : {},
    })
  );
}

describe("billing webhook route", () => {
  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = "sk_test_x";
    process.env.STRIPE_WEBHOOK_SECRET = SECRET;
    process.env.STRIPE_PRICE_PRO = "price_pro_1";
    process.env.STRIPE_PRICE_GROWTH = "price_growth_1";
    process.env.STRIPE_PRICE_AGENCY = "price_agency_1";
    run("DELETE FROM subscriptions");
    run("DELETE FROM organizations");
  });
  afterEach(() => {
    process.env = { ...ORIG_ENV };
  });

  it("accepts a paid checkout with a valid signature and upgrades the org", async () => {
    const orgId = makeTenant();
    const raw = JSON.stringify({
      id: "evt_1",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_1",
          mode: "subscription",
          payment_status: "paid",
          client_reference_id: orgId,
          subscription: "sub_1",
          metadata: { plan: "pro", tenant_id: orgId },
        },
      },
    });
    const res = await post(raw, sign(raw));
    expect(res.status).toBe(200);
    const org = getDb().prepare("SELECT plan FROM organizations WHERE id = ?").get(orgId) as {
      plan: string;
    };
    expect(org.plan).toBe("pro");
  });

  it("rejects a forged signature without touching the database", async () => {
    const orgId = makeTenant("free");
    const raw = JSON.stringify({
      id: "evt_e",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_evil",
          mode: "subscription",
          payment_status: "paid",
          client_reference_id: orgId,
          metadata: { plan: "agency" },
        },
      },
    });
    const res = await post(raw, "t=0,v1=fake");
    expect(res.status).toBe(400);
    expect(getDb().prepare("SELECT plan FROM organizations WHERE id = ?").get(orgId)).toMatchObject({
      plan: "free",
    });
  });

  it("does not accept webhooks when Stripe is unconfigured", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const raw = JSON.stringify({ id: "evt", type: "invoice.paid", data: { object: {} } });
    const res = await post(raw, sign(raw));
    expect(res.status).toBe(503);
  });

  it("downgrades the org to free on subscription.canceled", async () => {
    const orgId = makeTenant("growth");
    const raw = JSON.stringify({
      id: "evt_2",
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_1",
          status: "canceled",
          metadata: { tenant_id: orgId },
          items: { data: [] },
        },
      },
    });
    const res = await post(raw, sign(raw));
    expect(res.status).toBe(200);
    expect(getDb().prepare("SELECT plan FROM organizations WHERE id = ?").get(orgId)).toMatchObject({
      plan: "free",
    });
  });
});