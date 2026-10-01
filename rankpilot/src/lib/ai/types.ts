import type { z } from "zod";

export type Tier = "fast" | "smart";

export interface GenerateRequest {
  model: string;
  system: string;
  prompt: string;
  maxTokens: number;
  timeoutMs?: number;
}

export interface GenerateResult {
  text: string;
  usage: { tokensIn: number; tokensOut: number };
  durationMs: number;
}

export interface AIProvider {
  readonly name: string;
  readonly available: boolean;
  generate(req: GenerateRequest): Promise<GenerateResult>;
}

export interface RouteConfig {
  tier: Tier;
  model: string;
  maxTokens: number;
  timeoutMs: number;
}

/** Task → routing + prompt version + output schema. Data, not code, so swapping providers is one edit. */
export interface TaskDefinition<T> {
  task: string;
  version: string;
  route: RouteConfig;
  schema: z.ZodType<T>;
  /** Deterministic fallback used when no provider key is configured — never fabricated data. */
  fallback: (ctx: unknown) => T;
}

export const EPISTEMIC = {
  observed: "Observed data",
  interpretation: "AI interpretation",
  recommendation: "Recommendation",
} as const;

export type Epistemic = (typeof EPISTEMIC)[keyof typeof EPISTEMIC];
