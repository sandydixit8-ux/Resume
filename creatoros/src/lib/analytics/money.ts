import { all, row, type SQLParam } from "@/lib/db/db";
import { PLAN_PRICES } from "@/lib/plans";
import { formatMoneyCents } from "@/lib/money-format";

export interface RevenueSnapshot {
  mrrCents: number;
  lifeTimeCents: number;
  periodCents: number;
  subscriptionsActive: number;
  sources: { label: string; count: number; cents: number }[];
}

export interface RevenueMonthPoint {
  month: string;
  cents: number;
}

function q(tenantId: string, sql: string): number {
  return Number(all<{ c: number | string }>(sql, tenantId)[0]?.c ?? 0);
}

/** Recurring revenue from active paid subscriptions (MRR), using list prices. */
export function mrrCents(tenantId: string): number {
  const active = all<{ plan: string }>("SELECT plan FROM subscriptions WHERE tenant_id = ? AND status = 'active' AND plan != 'free'", tenantId);
  return active.reduce((sum, sub) => sum + (PLAN_PRICES[sub.plan]?.usd ?? 0) * 100, 0);
}

export function revenueSnapshot(tenantId: string, days = 30): RevenueSnapshot {
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const fromPayments = (clause: string, ...p: SQLParam[]): number =>
    Number(all<{ c: number | string }>(`SELECT COALESCE(SUM(amount_cents), 0) AS c FROM payments WHERE tenant_id = ? AND status = 'succeeded' ${clause}`, tenantId, ...p)[0]?.c ?? 0);
  const fromOrders = (clause: string, ...p: SQLParam[]): number =>
    Number(all<{ c: number | string }>(`SELECT COALESCE(SUM(amount_cents), 0) AS c FROM orders WHERE tenant_id = ? AND status = 'paid' ${clause}`, tenantId, ...p)[0]?.c ?? 0);

  const periodCents = fromPayments("AND created_at >= ?", since) + fromOrders("AND created_at >= ?", since);
  const allTime = fromPayments("") + fromOrders("");
  const subscriptionsActive = Number(q(tenantId, `SELECT COUNT(*) AS c FROM subscriptions WHERE tenant_id = ? AND status = 'active' AND plan != 'free'`));

  const sources = [
    { label: "Recurring (subscriptions)", count: subscriptionsActive, cents: mrrCents(tenantId) },
    { label: "One-time (orders)", count: Number(q(tenantId, `SELECT COUNT(*) AS c FROM orders WHERE tenant_id = ? AND status = 'paid'`)), cents: fromOrders("") },
    { label: "Bookings", count: Number(q(tenantId, `SELECT COUNT(*) AS c FROM bookings WHERE tenant_id = ? AND status = 'confirmed'`)), cents: Number(all<{ c: number | string }>("SELECT COALESCE(SUM(s.price_cents), 0) AS c FROM bookings b JOIN services s ON s.id = b.service_id WHERE b.tenant_id = ? AND b.status = 'confirmed'", tenantId)[0]?.c ?? 0) },
  ];

  return { mrrCents: mrrCents(tenantId), lifeTimeCents: allTime, periodCents, subscriptionsActive, sources };
}

export function revenueMonthlySeries(tenantId: string, months = 6): RevenueMonthPoint[] {
  const rows = all<{ month: string; cents: number }>(
    `SELECT substr(created_at, 1, 7) AS month, SUM(amount_cents) AS cents
     FROM payments WHERE tenant_id = ? AND status = 'succeeded' AND created_at >= ?
     GROUP BY month ORDER BY month`,
    tenantId,
    new Date(Date.now() - months * 31 * 86400000).toISOString()
  );
  const orderRows = all<{ month: string; cents: number }>(
    `SELECT substr(created_at, 1, 7) AS month, SUM(amount_cents) AS cents
     FROM orders WHERE tenant_id = ? AND status = 'paid' AND created_at >= ?
     GROUP BY month ORDER BY month`,
    tenantId,
    new Date(Date.now() - months * 31 * 86400000).toISOString()
  );

  const merged = new Map<string, number>();
  for (const r of [...rows, ...orderRows]) {
    merged.set(r.month, (merged.get(r.month) ?? 0) + Number(r.cents ?? 0));
  }

  const now = new Date();
  const out: RevenueMonthPoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    out.push({ month: key, cents: merged.get(key) ?? 0 });
  }
  return out;
}

/** Localized currency formatting helper for server + unit tests. */
export { formatMoneyCents };

export function lastChargeAt(tenantId: string): string | null {
  const r = row<{ created_at: string }>(
    "SELECT created_at FROM payments WHERE tenant_id = ? AND status = 'succeeded' ORDER BY created_at DESC LIMIT 1",
    tenantId
  );
  return r?.created_at ?? null;
}