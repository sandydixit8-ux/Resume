import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getDb, closeDb, run, row, all, newId, nowIso } from "@/lib/db/db";
import {
  createOrderForProduct,
  attachCheckoutSession,
  fulfillOrder,
  fulfillOrderBySession,
  markOrderFailed,
  getProduct,
  type ProductRow,
} from "./orders";

let dir: string;
const TENANT = "org_store_test";

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "creatoros-store-test-"));
  process.env.CREATOROS_DB_PATH = join(dir, "test.db");
  getDb();
  run(
    "INSERT INTO organizations (id, name, slug, plan, created_at, updated_at) VALUES (?, 'Store Test', 'test-store-org', 'creator', ?, ?)",
    TENANT,
    nowIso(),
    nowIso()
  );
});

afterAll(() => {
  closeDb();
  rmSync(dir, { recursive: true, force: true });
});

function seedProduct(priceCents = 1900): ProductRow {
  const id = newId("prd");
  run(
    "INSERT INTO products (id, tenant_id, name, description, price_cents, currency, kind, active, created_at, updated_at) VALUES (?, ?, 'Test product', 'desc', ?, 'usd', 'digital', 1, ?, ?)",
    id,
    TENANT,
    priceCents,
    nowIso(),
    nowIso()
  );
  return getProduct(id)!;
}

describe("store orders", () => {
  it("creates a pending order with item, contact and checkout session payment", () => {
    const product = seedProduct(2500);
    const order = createOrderForProduct(product, { email: "Buyer@Example.com", name: "Buyer" });
    expect(order.status).toBe("pending");
    expect(order.amount_cents).toBe(2500);
    expect(order.token.length).toBeGreaterThanOrEqual(16);

    const items = all("SELECT * FROM order_items WHERE order_id = ?", order.id);
    expect(items).toHaveLength(1);

    const contact = row<{ email: string }>("SELECT email FROM contacts WHERE tenant_id = ? AND email = ?", TENANT, "buyer@example.com");
    expect(contact?.email).toBe("buyer@example.com");

    attachCheckoutSession(order.id, "mock", "cs_test_123");
    const payment = row<{ status: string; provider_id: string }>("SELECT status, provider_id FROM payments WHERE order_id = ?", order.id);
    expect(payment?.status).toBe("pending");
    expect(payment?.provider_id).toBe("cs_test_123");

    const reloaded = row<{ provider_session_id: string; provider: string }>("SELECT provider_session_id, provider FROM orders WHERE id = ?", order.id);
    expect(reloaded?.provider_session_id).toBe("cs_test_123");
    expect(reloaded?.provider).toBe("mock");
  });

  it("fulfills idempotently — second call does not double-process", () => {
    const product = seedProduct(1000);
    const order = createOrderForProduct(product, { email: "pay@example.com" });
    attachCheckoutSession(order.id, "mock", "cs_test_456");

    expect(fulfillOrder(order.id)).toBe("paid");
    expect(fulfillOrder(order.id)).toBe("already_paid");

    const final = row<{ status: string }>("SELECT status FROM orders WHERE id = ?", order.id);
    expect(final?.status).toBe("paid");

    const payment = row<{ status: string }>("SELECT status FROM payments WHERE order_id = ?", order.id);
    expect(payment?.status).toBe("succeeded");

    const events = all("SELECT * FROM analytics_events WHERE tenant_id = ? AND event_type = 'purchase'", TENANT);
    expect(events).toHaveLength(1);
  });

  it("fulfills by provider session id (webhook path)", () => {
    const product = seedProduct(500);
    const order = createOrderForProduct(product, { email: "hook@example.com" });
    attachCheckoutSession(order.id, "mock", "cs_test_789");

    expect(fulfillOrderBySession("cs_test_789")).toBe("paid");
    expect(fulfillOrderBySession("cs_test_789")).toBe("already_paid");
    expect(fulfillOrderBySession("cs_missing")).toBe("not_found");
  });

  it("does not fulfill canceled orders and supports cancellation", () => {
    const product = seedProduct(700);
    const order = createOrderForProduct(product, { email: "cancel@example.com" });
    attachCheckoutSession(order.id, "mock", "cs_test_cancel");

    markOrderFailed(order.id, "canceled");
    expect(fulfillOrder(order.id)).toBe("not_payable");
    const final = row<{ status: string }>("SELECT status FROM orders WHERE id = ?", order.id);
    expect(final?.status).toBe("canceled");
  });

  it("returns not_found for unknown orders", () => {
    expect(fulfillOrder("ord_missing")).toBe("not_found");
  });
});
