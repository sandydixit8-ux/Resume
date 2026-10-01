import type { RouteConfig } from "./types";

const SMART = process.env.OPENAI_SMART_MODEL || "gpt-4o-mini";
const FAST = process.env.OPENAI_FAST_MODEL || "gpt-4o-mini";

/** Central model routing table. Swap model names here — never inside prompts or callers. */
const ROUTES: Record<string, RouteConfig> = {
  "issue.fix": { tier: "fast", model: FAST, maxTokens: 600, timeoutMs: 20_000 },
  "question.answer": { tier: "smart", model: SMART, maxTokens: 700, timeoutMs: 30_000 },
  "geo.recommendations": { tier: "smart", model: SMART, maxTokens: 1200, timeoutMs: 30_000 },
  "content.optimize": { tier: "smart", model: SMART, maxTokens: 3000, timeoutMs: 60_000 },
  "content.generate": { tier: "smart", model: SMART, maxTokens: 4000, timeoutMs: 90_000 },
  "social.ideas": { tier: "smart", model: SMART, maxTokens: 2500, timeoutMs: 45_000 },
  "social.hooks": { tier: "fast", model: FAST, maxTokens: 1500, timeoutMs: 30_000 },
  "social.script": { tier: "smart", model: SMART, maxTokens: 3000, timeoutMs: 60_000 },
  "social.captions": { tier: "fast", model: FAST, maxTokens: 1500, timeoutMs: 30_000 },
  "copilot.answer": { tier: "smart", model: SMART, maxTokens: 1500, timeoutMs: 45_000 },
  "agent.priorities": { tier: "smart", model: SMART, maxTokens: 1500, timeoutMs: 45_000 },
  "content.repurpose": { tier: "smart", model: SMART, maxTokens: 3000, timeoutMs: 60_000 },
};

const DEFAULT: RouteConfig = { tier: "smart", model: SMART, maxTokens: 1500, timeoutMs: 45_000 };

export function route(task: string): RouteConfig {
  return ROUTES[task] ?? DEFAULT;
}
