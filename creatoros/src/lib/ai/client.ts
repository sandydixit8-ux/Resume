const BASE_URL = process.env.AI_BASE_URL || "https://api.openai.com/v1";
const MODEL = process.env.AI_MODEL || "gpt-4o-mini";
const KEY = process.env.AI_API_KEY || process.env.OPENAI_API_KEY || "";

export function aiConfigured(): boolean {
  return Boolean(KEY);
}

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AiResponse {
  text: string;
  usage?: { prompt: number; completion: number; total: number };
}

export async function complete(messages: ChatMessage[], opts: { temperature?: number; maxTokens?: number } = {}): Promise<AiResponse> {
  if (!KEY) {
    throw new Error("AI_API_KEY is not configured. Set AI_API_KEY / OPENAI_API_KEY.");
  }
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: opts.temperature ?? 0.4,
      max_tokens: opts.maxTokens ?? 1200,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`AI request failed ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  };
  const text = data.choices?.[0]?.message?.content?.trim() || "";
  return {
    text,
    usage: data.usage
      ? { prompt: data.usage.prompt_tokens ?? 0, completion: data.usage.completion_tokens ?? 0, total: data.usage.total_tokens ?? 0 }
      : undefined,
  };
}

/** Strip markdown code fences from an AI response that should be raw JSON. */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object found in AI response");
  return JSON.parse(candidate.slice(start, end + 1));
}