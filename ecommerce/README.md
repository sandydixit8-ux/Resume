# Nexus — E-Commerce Platform

Production-grade, India-first e-commerce platform. Monorepo of a Next.js storefront, a Next.js admin,
and a NestJS API over PostgreSQL/Prisma. Architecture-first (see `docs/`).

## Stack

| Layer | Choice |
|---|---|
| Monorepo | pnpm workspaces + Turborepo |
| Storefront / Admin | Next.js 14 (App Router) + Tailwind |
| API | NestJS 10 (modular monolith) |
| DB | PostgreSQL + Prisma |
| Queue (later) | Redis + BullMQ |
| Payments / Logistics | Razorpay / Shiprocket (behind interfaces) |
| Search (later) | Postgres FTS → Typesense |

## Layout

```
apps/storefront   # public shop (port 3000)
apps/admin        # admin console (port 3001)
apps/api          # REST API, /api/v1 (port 4000), swagger /docs
packages/contracts  # shared DTOs & error codes
packages/db         # Prisma schema + seed
packages/ui         # tokens + React components (consumed as TS source)
packages/config     # shared tsconfig / eslint / prettier
docs/               # architecture docs + STATUS.md (session continuity)
```

## Prereqs

- Node 24, pnpm 9
- PostgreSQL running locally (e.g. Docker or Postgres.app), plus Redis later

```sh
pnpm install
cp .env.example apps/api/.env   # set DATABASE_URL + JWT secrets + FIRST_ADMIN_*
pnpm db:generate                # prisma generate
pnpm db:migrate                 # prisma migrate dev (creates schema)
pnpm db:seed                    # roles + permissions + FIRST_ADMIN
```

## Commands

```sh
pnpm dev          # all apps in dev mode
pnpm --filter @nexus/api dev           # API only: http://localhost:4000
pnpm --filter @nexus/storefront dev    # storefront: http://localhost:3000
pnpm --filter @nexus/admin dev         # admin: http://localhost:3001
pnpm typecheck
pnpm build
pnpm lint
pnpm db:studio
```

## Auth flow

- Register → email/phone OTP verify → activate (roles: CUSTOMER default).
- Login issues access token (localStorage) + refresh token (httpOnly cookie, path `/api/v1/auth`).
- Refresh rotates the refresh token; reuse detection revokes the session. 5 failed logins → 15-min lock.
- Admin endpoints guarded by permission codes (`role.view`, `role.assign`, `user.view`, …).

## Status

See `docs/STATUS.md` for the current phase, what's verified, and the next recommended action.