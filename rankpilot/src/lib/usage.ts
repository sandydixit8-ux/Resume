import { all, newId, row, run } from "@/lib/db/db";
import { currentPeriod, getLimits, withinLimit } from "@/lib/plans";

export function bumpUsage(tenantId: string, metric: string, amount = 1): number {
  const period = currentPeriod();
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
  const r = row<{ used: number }>(
    "SELECT used FROM plans_usage WHERE tenant_id = ? AND metric = ? AND period = ?",
    tenantId,
    metric,
    currentPeriod()
  );
  return r?.used ?? 0;
}

export function allUsage(tenantId: string): Record<string, number> {
  const rows = all<{ metric: string; used: number }>(
    "SELECT metric, used FROM plans_usage WHERE tenant_id = ? AND period = ?",
    tenantId,
    currentPeriod()
  );
  const out: Record<string, number> = {};
  for (const r of rows) out[r.metric] = r.used;
  return out;
}

export function usageReport(tenantId: string, plan: string) {
  const limits = getLimits(plan);
  const used = allUsage(tenantId);
  const metrics = Object.keys(limits).map((metric) => ({
    metric,
    used: used[metric] ?? 0,
    limit: (limits as unknown as Record<string, number>)[metric],
  }));
  return { period: currentPeriod(), plan, metrics };
}

export function hasQuota(tenantId: string, plan: string, metric: string): boolean {
  const limits = getLimits(plan) as unknown as Record<string, number>;
  const limit = limits[metric];
  if (limit === undefined) return true;
  return withinLimit(getUsage(tenantId, metric), limit);
}
