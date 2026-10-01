import { newId, nowIso, row, run } from "@/lib/db/db";
import { getLimits, withinLimit } from "@/lib/plans";
import { getUsage, bumpUsage } from "@/lib/usage";

/** USD per 1K tokens — coarse pricing table so cost stays data, not guesswork, in the UI. */
const PRICE_PER_1K: Record<string, { in: number; out: number }> = {
  "gpt-4o-mini": { in: 0.00015, out: 0.0006 },
  "gpt-4o": { in: 0.005, out: 0.015 },
};

export class QuotaExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuotaExceededError";
  }
}

export function assertAiQuota(tenantId: string, plan: string): void {
  const limits = getLimits(plan);
  if (!withinLimit(getUsage(tenantId, "aiGenerations"), limits.aiGenerations)) {
    throw new QuotaExceededError(
      "AI generation limit reached for your plan. Upgrade or wait for the next period."
    );
  }
}

export function assertSocialQuota(tenantId: string, plan: string): void {
  const limits = getLimits(plan);
  if (!withinLimit(getUsage(tenantId, "socialGenerations"), limits.socialGenerations)) {
    throw new QuotaExceededError(
      "Social generation limit reached for your plan. Upgrade or wait for the next period."
    );
  }
}

export function assertReportQuota(tenantId: string, plan: string): void {
  const limits = getLimits(plan);
  if (!withinLimit(getUsage(tenantId, "reports"), limits.reports)) {
    throw new QuotaExceededError("Report generation limit reached for your plan.");
  }
}

export interface MeterInput {
  tenantId: string | null;
  task: string;
  model: string;
  promptVersion: string;
  tokensIn: number;
  tokensOut: number;
  durationMs: number;
  status: "ok" | "fallback" | "error" | "quota";
  provider: string;
  /**
   * Which plan quota this call spends. Social tasks are billed against
   * `socialGenerations`, everything else against `aiGenerations` — they are
   * separate limits in `plans.ts` and are checked separately in `run.ts`.
   */
  metric?: "aiGenerations" | "socialGenerations";
}

export function meterCall(input: MeterInput): string {
  const perK = PRICE_PER_1K[input.model] ?? PRICE_PER_1K["gpt-4o-mini"];
  const cost = (input.tokensIn / 1000) * perK.in + (input.tokensOut / 1000) * perK.out;
  const id = newId("aiu");
  run(
    `INSERT INTO ai_usage (id, tenant_id, task, model, prompt_version, tokens_in, tokens_out,
       cost_usd, cached, duration_ms, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
    id,
    input.tenantId,
    input.task,
    input.model,
    input.promptVersion,
    input.tokensIn,
    input.tokensOut,
    Number(cost.toFixed(6)),
    input.durationMs,
    input.status,
    nowIso()
  );
  if (input.tenantId && input.status === "ok") {
    bumpUsage(input.tenantId, input.metric ?? "aiGenerations", 1);
  }
  return id;
}

export function monthlySpend(tenantId: string): { month: string; costUsd: number; calls: number } {
  const period = new Date().toISOString().slice(0, 7);
  const r = row<{ cost: number | null; n: number }>(
    `SELECT SUM(cost_usd) AS cost, COUNT(*) AS n FROM ai_usage
     WHERE tenant_id = ? AND created_at LIKE ?`,
    tenantId,
    `${period}%`
  );
  return { month: period, costUsd: Number((r?.cost ?? 0).toFixed(4)), calls: r?.n ?? 0 };
}
