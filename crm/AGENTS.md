# AGENTS.md

Guidance for coding agents working in this repo. Read before making changes.

## Environment

- OS: **Windows, PowerShell 5.1**. `npm.ps1` may be blocked — use **`npm.cmd`** / `npx.cmd` explicitly.
- Node 24+, npm 11+. Do not change Node/npm versions.
- The project lives in `crm/` (this is a subfolder of a workspace).

## Commands

- **Typecheck**: `npx.cmd tsc --noEmit -p tsconfig.json`
- **Lint**: `npm.cmd run lint` (must be 0 errors; warnings about unused imports are acceptable but avoid adding new ones)
- **Build**: `npm.cmd run build` (this also type-checks)
- **Tests**: `npm.cmd run test` (Vitest, node environment, `src/**/*.test.ts`)
- After any code change that compiles, run typecheck + lint (and build when feasible). Fix all errors before finishing.

## Architecture

- **Next.js 15 App Router** with route groups: `(auth)`, `(onboarding)`, `(app)` (inside `src/app/`).
- **Supabase**: Auth + Postgres + RLS. Tenant isolation is enforced by RLS, NOT by application filters alone.
  - Clients: `src/lib/supabase/server.ts` (async, uses `await cookies()`), `browser.ts`, `admin.ts` (service role — server only).
  - `createClient()` is **async** — always `await` it.
- **Server actions**: `src/lib/actions/*.ts` with `"use server"`. All mutations must:
  1. validate with Zod (`src/lib/validators.ts`),
  2. resolve session + org via `sessionOrg()` / `requireUser()`,
  3. check permission keys from `src/lib/rbac.ts` before mutating,
  4. call `writeAuditLog(...)` (never throws),
  5. `revalidatePath` the affected routes.
- **Data loaders**: `src/lib/data/*.ts` — server-only (`import "server-only"`), RLS-scoped. Never call these from client components.
- **Types**: `src/types/supabase.ts` holds hand-maintained `Database` types and entity interfaces. Each table maps to `DbTable<Row>` (Row typed; Insert/Update permissive). Keep new tables in sync here and in `supabase/migrations/`.
- **UI primitives** in `src/components/ui/` (button, card, badge, table, sheet, tabs, form, empty-state, kpi-card…). Reuse them; don't hand-roll styles. Design tokens via CSS variables (`--primary`, `--border`, …).

## Conventions

- **DO NOT add comments** unless asked. Let code speak.
- **No fake buttons** — unimplemented features render a "Coming soon" state (`ComingSoonButton`), they must not pretend to work.
- **No hard-coded tenant IDs / secrets** — always from session/env. Never commit `.env.local` or real keys.
- **Money** computed server-side via `src/lib/tax.ts` (CGST/SGST for intra-state, IGST for inter-state). Totals on quotes/orders/invoices are stored, not recomputed on the client.
- **Soft-delete** leads/customers/orders via `is_deleted`; inventory mutations go through the immutable `inventory_transactions` ledger (never edit stock in place).
- **WhatsApp/email/SMS** go through the provider abstraction `src/lib/providers/notification.ts` (default `mock`). Never wire real vendor SDKs directly into features.
- **AI output** is a recommendation, never auto-applied (see `src/lib/scoring.ts`).
- Pages that read session state export `export const dynamic = "force-dynamic"`.
- New nav entries go in `src/lib/nav.ts` (sections, bottom nav, FAB actions) and must be permission-gated.
- Follow existing file patterns (look at `src/lib/actions/crm.ts`, `src/lib/data/customers.ts`, `src/components/leads/lead-detail-client.tsx` for reference).

## Verification workflow

1. `npx.cmd tsc --noEmit -p tsconfig.json`
2. `npm.cmd run lint`
3. `npm.cmd run build` (only if a server page/route changed)
4. If you added pure logic (e.g. tax/scoring), add a Vitest unit test in `src/lib/__tests__/`.

## Notes

- No live Supabase/`.env.local` in this environment, so RLS/migrations/seed can't be executed here — verify SQL by reading and matching types. Do not invent `.env.local`.
- Only commit when explicitly asked.
