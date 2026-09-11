# VyaparOne CRM

Mobile-first, multi-tenant SaaS CRM for Indian SMBs (distributors, wholesalers,
dealers). Built with Next.js (App Router) + Supabase (Auth, Postgres, RLS).

> Tenancy, permissions and audit are enforced in the database via RLS and a
> server-side role model. The app never trusts the client for auth decisions.

## Features (current)

- **Auth** — email/OTP sign in, sign up, forgot password, email verify.
- **Onboarding** — create business, first branch, invite teammates, load products
  (or realistic demo data for "Sharma Distributors").
- **CRM** — lead capture + scoring (HOT/WARM/COLD), pipeline kanban with
  drag-and-drop, customers, tasks & follow-ups, activity log, field visits.
- **Sales** — products catalog (categories, SKU, GST), quotations with server
  GST totals + status flow + convert-to-order, orders with lifecycle, and
  automatic stock deduction + delivery creation on dispatch.
- **Inventory** — immutable stock ledger (purchase/sale/transfer/adjust/damage),
  per-warehouse balances, low-stock flags, warehouses.
- **Multi-tenant** — every table is RLS-scoped to the caller's organization and
  branch; roles/permissions drive UI visibility and data access.
- **Operations (next)** — invoices, payments, delivery workflow, attendance.

## Tech stack

| Layer      | Choice                                          |
| ---------- | ----------------------------------------------- |
| Framework  | Next.js 15 (App Router, `src/`)                 |
| Language   | TypeScript (strict)                             |
| Styling    | Tailwind CSS v4 + CSS design tokens             |
| Database   | Supabase Postgres + RLS                         |
| Auth       | Supabase Auth (email/OTP)                       |
| Validation | Zod v4                                          |
| Tests      | Vitest                                          |
| UI         | Custom primitives in `src/components/ui`        |

## Getting started

```bash
# 1. install
npm install

# 2. configure environment
cp .env.local.example .env.local   # fill in Supabase keys

# 3. apply the database schema + RLS + seed bootstrap
supabase start   # or use a hosted project, then:
supabase db push

# 4. run
npm run dev      # http://localhost:3000
```

### Scripts

| Command              | Purpose                          |
| -------------------- | -------------------------------- |
| `npm run dev`        | Start dev server                 |
| `npm run build`      | Production build (type-checks)   |
| `npm run start`      | Serve production build           |
| `npm run lint`       | ESLint                           |
| `npm run typecheck`  | `tsc --noEmit`                   |
| `npm run test`       | Run Vitest once                  |
| `npm run test:watch` | Vitest watch mode                |

## Database

Migrations live in `supabase/migrations/`:

1. `0001_*` — helpers (`current_org_id()`, `user_org_scope()`,
   `user_accessible_branch_ids()`, `can_access_branch()`, `has_permission()`).
2. `0002_*` — identity & tenant (organizations, branches, users, roles,
   permissions, invitations).
3. `0003_*` — CRM (leads, pipelines, opportunities, customers, activities,
   tasks, follow-ups, visits, attendance).
4. `0004_*` — sales & inventory (products, warehouses, inventory ledger,
   quotations, orders, deliveries, invoices, payments).
5. `0005_*` — comms, automation & audit (messages, campaigns, notifications,
   automations, ai_jobs, documents, audit_logs, webhooks, plans).
6. `0006_*` — seed bootstrap: `bootstrap_organization(p_org)` seeds permissions,
   roles, default pipeline stages and lead sources for a new organization.

Run migrations against your project (local via `supabase start` or hosted)
before the app can sign up users.

## Project structure

```
src/
  app/            Next.js App Router (route groups: (auth), (onboarding), (app))
  components/     UI primitives (ui/) + feature components (leads/, customers/…)
  lib/            server-only logic: supabase clients, auth, rbac, audit,
                  scoring, tax, validators, data loaders, server actions
  types/          hand-maintained Supabase Database types
supabase/
  migrations/     SQL schema + RLS + bootstrap
docs/             01..17 — product & technical design docs, roadmap
```

## Conventions

- **Server actions** live in `src/lib/actions/*.ts` (`"use server"`).
- **Data loaders** live in `src/lib/data/*.ts` (server-only, RLS-scoped).
- **Authz** flows through `src/lib/auth.ts` (`requireUser`, `getUserContext`)
  and `src/lib/rbac.ts` permission keys; check permission before mutating.
- **Money** is always computed server-side (`src/lib/tax.ts`); GST split into
  CGST/SGST (intra-state) or IGST (inter-state).
- **Soft deletes** for leads/customers/orders (`is_deleted`); inventory changes
  go through the immutable `inventory_transactions` ledger.
- **Audit**: every meaningful mutation calls `writeAuditLog` (never throws).
- **No fake buttons** — unimplemented features render a "Coming soon" state.
- Pages that read session state export `export const dynamic = "force-dynamic"`.

## Docs

Product & technical decisions are captured in `docs/` (01 product overview
through 17 roadmap). Phases 1–3 (foundation, CRM core, sales & inventory) are
built; Phase 4 (operations: invoices, payments, delivery workflow) is next.
