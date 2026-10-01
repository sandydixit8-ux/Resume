import type { AIProvider, GenerateRequest, GenerateResult } from "./types";

/** Used when OPENAI_API_KEY is absent: returns a structured "unavailable" payload so callers degrade gracefully. */
export class NullProvider implements AIProvider {
  readonly name = "null";
  readonly available = false;

  async generate(req: GenerateRequest): Promise<GenerateResult> {
    return {
      text: JSON.stringify({
        unavailable: true,
        reason: "AI provider is not configured. Set OPENAI_API_KEY to enable generation.",
        echo: req.prompt.slice(0, 0),
      }),
      usage: { tokensIn: 0, tokensOut: 0 },
      durationMs: 0,
    };
  }
}

export class OpenAIProvider implements AIProvider {
  readonly name = "openai";
  readonly available = true;

  constructor(private readonly apiKey: string) {}

  async generate(req: GenerateRequest): Promise<GenerateResult> {
    const started = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), req.timeoutMs ?? 60_000);
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: req.model,
          max_tokens: req.maxTokens,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: req.system },
            { role: "user", content: req.prompt },
          ],
        }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(`provider_error_${res.status}: ${detail.slice(0, 300)}`);
      }
      const body = (await res.json()) as {
        choices: Array<{ message: { content: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      return {
        text: body.choices?.[0]?.message?.content ?? "",
        usage: {
          tokensIn: body.usage?.prompt_tokens ?? 0,
          tokensOut: body.usage?.completion_tokens ?? 0,
        },
        durationMs: Date.now() - started,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

let cached: AIProvider | null = null;

export function getProvider(): AIProvider {
  if (cached) return cached;
  const key = process.env.OPENAI_API_KEY;
  cached = key ? new OpenAIProvider(key) : new NullProvider();
  return cached;
}

/** Test hook. */
export function setProvider(p: AIProvider | null): void {
  cached = p;
}
