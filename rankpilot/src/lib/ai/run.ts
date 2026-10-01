import { PROMPTS } from "./prompts";
import { route } from "./router";
import { getProvider } from "./provider";
import { guardrailPass } from "./guardrails";
import { assertAiQuota, meterCall, QuotaExceededError } from "./meter";
import type { z } from "zod";

export interface TaskResult<T> {
  data: T;
  source: "ai" | "rules";
  model: string;
  promptVersion: string;
  /** Present when AI was unavailable and the deterministic fallback ran. */
  degraded?: string;
}

/**
 * Which plan quota a task spends. `plans.ts` sells these as two separate
 * limits, so the meter must bill the same one that `runTask` checks.
 */
function quotaMetric(social?: boolean): "aiGenerations" | "socialGenerations" {
  return social ? "socialGenerations" : "aiGenerations";
}

/**
 * Quota → prompt → provider (1 retry on invalid JSON/schema) → guardrails → meter.
 * With no provider key, falls back to the task's deterministic rules implementation.
 */
export async function runTask<T>(opts: {
  tenantId: string;
  plan: string;
  task: string;
  schema: z.ZodType<T>;
  context: unknown;
  renderCtx: Record<string, unknown>;
  fallback: () => T;
  social?: boolean;
  provider?: string;
}): Promise<TaskResult<T>> {
  const cfg = route(opts.task);
  const tpl = PROMPTS[opts.task];
  if (!tpl) throw new Error(`no_prompt:${opts.task}`);

  try {
    if (opts.social) {
      const { assertSocialQuota } = await import("./meter");
      assertSocialQuota(opts.tenantId, opts.plan);
    } else {
      assertAiQuota(opts.tenantId, opts.plan);
    }
  } catch (e) {
    if (e instanceof QuotaExceededError) {
      meterCall({
        tenantId: opts.tenantId,
        task: opts.task,
        model: cfg.model,
        promptVersion: tpl.version,
        tokensIn: 0,
        tokensOut: 0,
      durationMs: 0,
      status: "quota",
      provider: "none",
      metric: quotaMetric(opts.social),
    });
    }
    throw e;
  }

  const provider = getProvider();
  const system = tpl.system;
  const prompt = tpl.render(opts.renderCtx);
  const contextJson = JSON.stringify(opts.context ?? {});

  if (!provider.available) {
    const data = opts.fallback();
    meterCall({
      tenantId: opts.tenantId,
      task: opts.task,
      model: cfg.model,
      promptVersion: tpl.version,
      tokensIn: 0,
      tokensOut: 0,
      durationMs: 0,
      status: "fallback",
      provider: provider.name,
      metric: quotaMetric(opts.social),
    });
    return {
      data,
      source: "rules",
      model: cfg.model,
      promptVersion: tpl.version,
      degraded: "AI provider not configured — showing deterministic rules output.",
    };
  }

  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const fullPrompt = attempt === 0 ? prompt : `${prompt}\n\nPrevious output failed validation: ${lastError}\nReturn corrected JSON only.`;
    const res = await provider.generate({
      model: cfg.model,
      system,
      prompt: fullPrompt,
      maxTokens: cfg.maxTokens,
      timeoutMs: cfg.timeoutMs,
    });

    meterCall({
      tenantId: opts.tenantId,
      task: opts.task,
      model: cfg.model,
      promptVersion: tpl.version,
      tokensIn: res.usage.tokensIn,
      tokensOut: res.usage.tokensOut,
      durationMs: res.durationMs,
      status: "ok",
      provider: provider.name,
      metric: quotaMetric(opts.social),
    });

    const guarded = guardrailPass(res.text, contextJson);
    const parsed = safeParseJson(guarded.text);
    const check = opts.schema.safeParse(parsed);
    if (check.success) {
      return { data: check.data, source: "ai", model: cfg.model, promptVersion: tpl.version };
    }
    lastError = check.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
  }

  const data = opts.fallback();
  return {
    data,
    source: "rules",
    model: cfg.model,
    promptVersion: tpl.version,
    degraded: `AI output failed validation (${lastError}) — showing deterministic rules output.`,
  };
}

function safeParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

export { QuotaExceededError };
