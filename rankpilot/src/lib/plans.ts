export interface PlanLimits {
  websites: number;
  pagesPerCrawl: number;
  keywords: number;
  competitors: number;
  aiGenerations: number;
  reports: number;
  socialGenerations: number;
}

export const PLANS: Record<string, PlanLimits> = {
  free: { websites: 1, pagesPerCrawl: 50, keywords: 50, competitors: 0, aiGenerations: 10, reports: 3, socialGenerations: 10 },
  pro: { websites: 3, pagesPerCrawl: 250, keywords: 500, competitors: 2, aiGenerations: 200, reports: 30, socialGenerations: 200 },
  growth: { websites: 10, pagesPerCrawl: 1000, keywords: 5000, competitors: 5, aiGenerations: 1000, reports: 150, socialGenerations: 1000 },
  agency: { websites: -1, pagesPerCrawl: 2000, keywords: -1, competitors: 20, aiGenerations: 5000, reports: -1, socialGenerations: 5000 },
};

export const PLAN_PRICES: Record<string, { usd: number }> = {
  free: { usd: 0 },
  pro: { usd: 29 },
  growth: { usd: 79 },
  agency: { usd: 199 },
};

/**
 * Ascending plan order, so a change can be classified as an upgrade or a
 * downgrade. Ordering is by price, not by the declaration order above, because
 * the two can drift apart and a wrong answer here would either block a
 * downgrade (stranding an account on a plan it can no longer afford) or treat a
 * downgrade as an upgrade (refusing to let a customer reduce their commitment).
 *
 * Unknown plans rank as the cheapest, which is the safe direction: the app
 * never accidentally believes a customer is on something better than it is.
 */
export const PLAN_RANK: Record<string, number> = Object.fromEntries(
  Object.entries(PLAN_PRICES)
    .map(([name, { usd }]) => [name, usd] as const)
    .sort((a, b) => a[1] - b[1])
    .map(([name], index) => [name, index])
);

export function planRank(plan: string): number {
  return PLAN_RANK[plan] ?? 0;
}

export function isDowngrade(from: string, to: string): boolean {
  return planRank(to) < planRank(from);
}

export function getLimits(plan: string): PlanLimits {
  return PLANS[plan] ?? PLANS.free;
}

export function currentPeriod(): string {
  return new Date().toISOString().slice(0, 7);
}

export function withinLimit(used: number, limit: number): boolean {
  return limit === -1 || used < limit;
}
