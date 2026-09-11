# M. AI Architecture

## Principles
1. AI operates on authorized CRM data only (same RLS scope as the user).
2. AI can never bypass permissions; every tool call it makes is a
   permission-checked server action.
3. Destructive/bulk actions always ask for confirmation before executing.
4. Outputs (score, descriptions) are labelled as recommendations, not
   guarantees or verified metrics.
5. Provider-abstraction (`LLMProvider`) so models can be swapped.

## LLMProvider
```
LLMProvider
├── chat(messages, context)                -> reply
├── structured(prompt, schema, input)      -> typed result (scoring, catalogue)
├── summarize(rows, question)              -> natural-language answers
└── draft(channel, context)                -> message drafts
```
Env-mock implementations return helpful canned responses for development when
`AI_API_KEY` is absent (clearly marked as mock).

## AI Assistant
- Chat on `/assistant`. The model receives the user's permission scope and can
  call bounded tools:
  - `query_leads(filters)` -> rows (respecting `lead.view` + tenant/branch)
  - `query_customers`, `query_opportunities`, `query_orders`, `query_tasks`
  - `create_followup(...)` -> requires `followup.create` + confirmation for bulk
  - `draft_message(...)` -> returns draft; sending requires user send + consent
- Prompting asks the model to answer from data it actually retrieved; it may say
  "I couldn't find…" rather than guessing. No fabricated metrics.

## Lead scoring
Deterministic, transparent, configurable algorithm over signals:
- source weight, recency (last contacted), interaction count, opportunity
  value, product-interest depth, priority overrides.
- Score 0-100 -> HOT 80-100, WARM 50-79, COLD 0-49. Score shown with caption
  "algorithmic recommendation".

## AI catalogue
- Image/document/name -> draft description, short description, marketing text,
  tags, keywords, suggested category + attributes. Never auto-published; always
  user review -> Save.
- `ai_jobs` row tracks status; generated content flagged `is_ai_generated`.

## Data safety
- No training on customer data; prompts/context minimal and accessed via
  server routes only; AI never receives JWT/credentials.
- All assistant actions audited (`audit_logs`, category `ai`).