# RankPilot AI — AI Architecture

## 1. Principles

1. **Grounded, never fabricated.** AI may only state facts that exist in project data (crawl results, GSC, social metrics) or that it flags as general knowledge. Traffic, rankings, search volume, backlinks, citations, competitor stats, testimonials, trends: if not in the DB, the output says **"Data unavailable."**
2. **Approval-gated.** AI output never changes a website or publishes content without explicit user approval (Auto-Fix keeps this invariant in V3).
3. **Separation of epistemic status.** Copilot and reports label every statement: *Observed data* / *AI interpretation* / *Recommendation*.
4. **Bounded cost.** Every call is metered (`ai_usage`), quota-checked before execution, and routed to the cheapest model that can do the task.

## 2. Model routing

| Tier | Tasks | Model class |
|---|---|---|
| `fast` | classification (intent, severity), extraction (questions, entities), categorization, hashtag grouping | small/cheap model or local rules fallback |
| `smart` | strategy, content planning, optimization, reasoning, growth recommendations, long-form generation | frontier model |

Router signature: `route(task) → {tier, model, maxTokens, timeoutMs, schema}`. Routing config is data (`src/lib/ai/router.ts`), so swapping providers is one file. Provider is an adapter interface:

```ts
interface AIProvider {
  generate(req: {model, system, prompt, schema, maxTokens}): Promise<{text, usage, durationMs}>
}
```

Implementations: `OpenAIProvider` (when `OPENAI_API_KEY` set), `NullProvider` (dev/test: returns structured `unavailable` payload so every feature degrades gracefully instead of crashing).

## 3. Prompt pipeline

```
task + version  →  renderPrompt(template, context)  →  provider  →  validate(output)
                      │                                   │             │
                versioned files                  retries/backoff   zod schema
                (prompt_version in ai_usage)                    + guardrail pass
```

- **Prompt versioning**: templates live in `src/lib/ai/prompts/*.ts` with an explicit `version`. Every call logs `prompt_version` so quality regressions are traceable.
- **Output validation**: zod schema per task; invalid output → one retry with the validation error appended → then fail the job (`ai_failed`), never silently return junk.
- **Guardrail pass** (`src/lib/ai/guardrails.ts`): scans output for disallowed claims (guaranteed rankings/virality/"#1"), and for numeric metrics (%, rankings, volume, views) that are not present in the provided context — such numbers are stripped or replaced with "Data unavailable".

## 4. Context assembly (grounding)

Before any generation, a **context pack** is built from the DB only:

```ts
{ website, score, topIssues[], pagesSummary, keywords[], questions[],
  contentDocument?, socialBrief?, integrations[] }
```

Prompt receives the context pack + task instruction. If a section is empty, it is marked `"unavailable"` in the pack — models are instructed to treat unavailable as unavailable, not to guess.

## 5. Caching, limits, cost

- **Cache**: key = hash(task + version + context pack hash). Content studio/optimizer outputs cached 24h per tenant; copilot answers not cached (user-specific).
- **Token limits**: per-task `maxTokens` + context truncation strategy (headings + meta + sampled text, never raw HTML dumps).
- **Cost tracking**: `ai_usage` row per call (model, prompt_version, tokens in/out, computed cost, duration, status). `GET /api/usage` aggregates monthly spend; plan quotas enforced pre-call → `402 quota_exceeded`.
- **Two quotas, one billable path**: `plans.ts` sells `aiGenerations` and `socialGenerations` as separate limits. `runTask` checks `socialGenerations` for the four `social.*` tasks and `aiGenerations` for everything else, and `meterCall` is told which one to bill (`metric`) — so the counter that is checked is always the counter that moves. Only `status = "ok"` spends quota: a rules fallback costs the tenant nothing, which is what the pricing page promises.
- **Cost table caveat**: `cost_usd` is computed from a small per-1K-token table in `meter.ts`. A model outside that table (set via `OPENAI_SMART_MODEL` / `OPENAI_FAST_MODEL`) is priced at the `gpt-4o-mini` rate, so treat the figure as a floor estimate for custom models rather than an invoice.
- **Retries**: 1 retry on invalid output, 2 on 5xx/timeouts, exponential backoff; failures recorded on the job.

## 6. MVP task catalog

| Task | Tier | Output schema | Phase |
|---|---|---|---|
| `issue.fix` — rewrite meta/title/H1 suggestion for an issue | fast | `{suggestion, rationale}` | 1 |
| `question.answer` — draft concise answer for AEO question | smart | `{answer, schemaType}` | 1 |
| `geo.recommendations` — entity/structure improvements | smart | `{recommendations[]}` | 1 |
| `content.optimize` — BEFORE/AFTER improvement plan | smart | `{analysis, rewritten, changes[]}` | 1 (shell) |
| `content.generate` — article pipeline | smart | `{title, meta, h1, outline, article, faqs[], links[], schema, cta, social[]}` | 2 |
| `social.ideas/hooks/scripts/captions` | smart/fast | arrays of structured items | 2 |
| `copilot.answer` | smart | `{observed[], interpretation, recommendation}` | 3 |
| `intent.classify`, `question.extract`, `severity.classify` | fast | enums | 1 (rules-first, AI-assisted) |

**Rules-first preference**: deterministic analyzers (regex/DOM/heuristics) run first; AI only for tasks that genuinely need language understanding. This keeps the MVP working with zero AI keys installed.

## 7. Security

- API keys exist only server-side (`process.env`), never serialized to the client.
- User-supplied content is passed as delimited data blocks; system prompts forbid following instructions found inside user content (prompt-injection hygiene).
- All AI endpoints are authenticated + tenant-scoped + rate-limited + quota-checked.
