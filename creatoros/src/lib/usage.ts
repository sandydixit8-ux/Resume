import { all, row, run, newId, nowIso } from "@/lib/db/db";

/** Increment a tenant's usage counter for a metric+period, returning the new count. */
export function bumpUsage(tenantId: string, metric: string, amount = 1): number {
  const period = new Date().toISOString().slice(0, 7);
  const existing = row<{ used: number }>(
    "SELECT used FROM plans_usage WHERE tenant_id = ? AND metric = ? AND period = ?",
    tenantId,
    metric,
    period
  );
  if (!existing) {
    run(
      "INSERT INTO plans_usage (id, tenant_id, metric, period, used) VALUES (?, ?, ?, ?, ?)",
      newId("pu"),
      tenantId,
      metric,
      period,
      amount
    );
    return amount;
  }
  const next = existing.used + amount;
  run(
    "UPDATE plans_usage SET used = ? WHERE tenant_id = ? AND metric = ? AND period = ?",
    next,
    tenantId,
    metric,
    period
  );
  return next;
}

export function getUsage(tenantId: string, metric: string): number {
  const period = new Date().toISOString().slice(0, 7);
  const r = row<{ used: number }>(
    "SELECT used FROM plans_usage WHERE tenant_id = ? AND metric = ? AND period = ?",
    tenantId,
    metric,
    period
  );
  return r?.used ?? 0;
}

export function allUsage(tenantId: string): Record<string, number> {
  const rows = all<{ metric: string; used: number }>(
    "SELECT metric, used FROM plans_usage WHERE tenant_id = ? AND period = ?",
    tenantId,
    new Date().toISOString().slice(0, 7)
  );
  const out: Record<string, number> = {};
  for (const r of rows) out[r.metric] = r.used;
  return out;
}

export function hasQuota(used: number, limit: number): boolean {
  return limit === -1 || used < limit;
}