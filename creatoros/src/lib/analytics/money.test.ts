import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getDb, closeDb, run, nowIso } from "@/lib/db/db";
import { mrrCents, revenueSnapshot, revenueMonthlySeries, lastChargeAt } from "./money";
import { formatMoneyCents } from "@/lib/money-format";

let dir: string;
const TENANT = "org_money_test";

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "creatoros-money-test-"));
  process.env.CREATOROS_DB_PATH = join(dir, "test.db");
  getDb();
  run("INSERT INTO organizations (id, name, slug, plan, created_at, updated_at) VALUES (?, 'Money', 'money-org', 'free', ?, ?)", TENANT, nowIso(), nowIso());
  run("INSERT INTO subscriptions (id, tenant_id, status, plan, created_at, updated_at) VALUES ('sub1', ?, 'active', 'pro', ?, ?)", TENANT, nowIso(), nowIso());
  run("INSERT INTO subscriptions (id, tenant_id, status, plan, created_at, updated_at) VALUES ('sub2', ?, 'active', 'starter', ?, ?)", TENANT, nowIso(), nowIso());
  run("INSERT INTO subscriptions (id, tenant_id, status, plan, created_at, updated_at) VALUES ('sub3', ?, 'canceled', 'creator', ?, ?)", TENANT, nowIso(), nowIso());
  run("INSERT INTO payments (id, tenant_id, amount_cents, status, created_at) VALUES ('pay1', ?, 4900, 'succeeded', ?)", TENANT, nowIso());
  run("INSERT INTO payments (id, tenant_id, amount_cents, status, created_at) VALUES ('pay2', ?, 1900, 'succeeded', ?)", TENANT, nowIso());
  run("INSERT INTO payments (id, tenant_id, amount_cents, status, created_at) VALUES ('pay3', ?, 5000, 'failed', ?)", TENANT, nowIso());
});

afterAll(() => {
  closeDb();
  rmSync(dir, { recursive: true, force: true });
});

describe("revenue analytics", () => {
  it("computes MRR from active paid subscriptions using list prices", () => {
    expect(mrrCents(TENANT)).toBe(4900 + 900); // pro $49 + starter $9, canceled creator excluded
  });

  it("sums succeeded payments only and reports lifetime + period", () => {
    const snap = revenueSnapshot(TENANT, 30);
    expect(snap.lifeTimeCents).toBe(6800); // 4900 + 1900, failed excluded, no orders
    expect(snap.periodCents).toBe(6800);
    expect(snap.subscriptionsActive).toBe(2);
    expect(snap.sources.find((s) => s.label.startsWith("Recurring"))?.cents).toBe(5800);
  });

  it("builds a 6-month zero-filled series", () => {
    const series = revenueMonthlySeries(TENANT, 6);
    expect(series.length).toBe(6);
    const last = series[series.length - 1];
    expect(last.cents).toBe(6800);
    expect(series.slice(0, 5).every((m) => m.cents === 0)).toBe(true);
  });

  it("reports the last successful charge", () => {
    expect(lastChargeAt(TENANT)).not.toBeNull();
    expect(lastChargeAt("missing-tenant")).toBeNull();
  });

  it("formats money in USD + INR", () => {
    expect(formatMoneyCents(123456)).toContain("$1,234.56");
    expect(formatMoneyCents(123456)).toContain("₹1,03,703");
  });
});