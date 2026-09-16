# Development Plan & Roadmap

## 1. Delivery principles

- Phase-by-phase with **verification gates**: a phase is done only when UI + backend + DB +
  validation + authZ + error/loading/empty states + responsive + a11y + security + tests +
  logging + analytics + docs all pass its Definition of Done (DoD below).
- Before each phase: No-Missing-Requirements pass (what breaks? payment fail, double webhook,
  inventory race, coupon expired, refresh mid-checkout, DB down, third-party down…).
- Context management: `ecommerce/STATUS.md` maintained with current phase, completed/pending/
  bugs/decisions/next-action, reviewed at session start.

## 2. Phases

### Phase 0 — Discovery (this doc set; go/no-go review)
- Approve architecture, stack, budgets (decisions in `14-MISSING-DECISIONS.md`).
- Legal/compliance review kick-off (terms, privacy, refund — legal advice required).

### Phase 1 — Foundation (2–4 wks)
Monorepo + tooling + CI; DB schema migration v1; auth (email/pw + OTP + refresh + lockout);
design system (tokens, core components); base API skeleton + error model + request-id + rate
limit + logging; admin RBAC bootstrap (seat tokens); infra (envs, backups, DR runbook, secrets).

### Phase 2 — Catalog & Discovery (3–5 wks)
Categories (tree, attrs, filters), brands, products/variants/images/video pipeline (Sharp + R2 +
CDN), PLP/PDP (gallery, zoom, pincode checker, delivery estimate v1, related/FBT/recent), search
v1 (Postgres FTS + pg_trgm), dynamic filters+sort, collections, product bulk import + validation
report, product status, SEO metadata + schema + sitemap.

### Phase 3 — Commerce (4–6 wks)
Cart (guest+logged, qty/stock/price validation, coupon, save-for-later, persistence); checkout
(address→delivery→summary→coupon→payment) with server-side pricing engine + idempotency;
payment abstraction + Razorpay (UPI/cards/netbanking/wallet/COD/EMI config, links later);
orders (full lifecycle + history + audit), payment verify + webhooks + reconciliation jobs,
refunds (full/partial/store credit); notifications: email templates (welcome/otp/order/payment/
shipping/delivery/cancel/return/refund/review request).

### Phase 4 — Operations (3–4 wks)
Inventory (warehouse, reservation, movements, low-stock, adjustments, audit); shipping abstraction
+ zones + serviceability + Shiprocket v1 + delivery estimates v2; returns/refunds workflow
(request→eligibility→approval→pickup→inspection→refund)+status UI; invoicing v1.

### Phase 5 — Admin & CMS (3–5 wks, parallelizable with 3–4)
Admin dashboard metrics; catalog/order/customer/inventory/marketing modules; coupons+promotions
rules 1.x; homepage CMS sections (hero, featured, collections); content pages/FAQs; bulk ops
(price/inventory/category/status/export); reports (sales/products/customers); roles/permissions
management + audit view; support tickets v1.

### Phase 6 — Growth (4–6 wks)
Search → Typesense (suggest/typo/synonyms/ranking + search analytics); reviews moderation +
helpful/report + verified purchase + seller response; wishlist v2 (multiple, price-drop,
back-in-stock); recommendations (rule-based: similar/FBT/trending/best-seller/personalized v1);
loyalty + referrals v1; abandoned-cart recovery; flash sales/deals pages; analytics events
pipeline + dashboards; notifications push architecture; SEO growth pass (structured data audit,
AMP not needed, OG/Twitter, speed).

### Phase 7 — Marketplace (when decided, 6–10 wks)
Seller registration + KYC; storefront; seller product listing with commission preview; seller
order/inventory/return handling; reviews + seller responses; payout/settlement jobs +
reconciliation; order splitting (multi-seller) + unified customer view; seller analytics;
customer support queue for disputes.

### Phase 8 — Scale & AI (continuous/quarterly)
Performance budget enforcement; caching/ISR/CDN pass; queue/worker tuning; Typesense cluster;
read replicas + analytics warehouse; service extraction only if org/traffic justifies; fraud
rules engine; AI: personalized recs (ML), assistant, natural-language search, review
summarization, demand forecasting, churn/next-best-offer. AI features modular, gated by flags,
never in money-critical path.

## 3. Milestone targets (indicative)

| Milestone | Defines |
|---|---|
| M1 (Phase 3 end) | Browse, search, cart, checkout, pay, order — customer can buy |
| M2 (Phase 5 end) | Ops + admin complete — operating a real store |
| M3 (Phase 6 end) | Growth features live — acquisition/conversion flywheel |
| M4 (Phase 7) | Marketplace live (conditional founder decision) |

## 4. Definition of Done (every feature)

UI ✓ Backend ✓ DB/migrations ✓ Validation (server) ✓ Auth+RBAC/ownership ✓ Error handling ✓
Loading/empty/error/retry states ✓ Responsive (mobile-first) ✓ Accessibility (WCAG AA basics) ✓
Security review (as applicable) ✓ Unit + integration tests ✓ E2E touchpoint ✓ Logging ✓
Analytics event ✓ Docs (API/Schema updated) ✓ No hard-coded values ✓

## 5. Verification regime

- CI gates per PR (lint/types/unit/integration/e2e/audits).
- Critical test scenarios: payment fail + retry; duplicate webhook; inventory race
  (concurrent checkout on last unit); coupon reuse/abuse; unauthorized access; API validation;
  mobile responsiveness; refresh mid-checkout; expired coupon mid-session; service down
  (payment/logistics) graceful degradation.
- Staging: full customer journey regression before every release.

## 6. Repo structure (target)

```
ecommerce/
  apps/
    storefront/   # Next.js public web
    admin/        # Next.js admin
    api/          # NestJS modular monolith
    worker/       # BullMQ workers
  packages/
    ui/           # design system components
    config/       # shared tsconfig, eslint, tailwind
    db/           # Prisma schema + migrations
    contracts/    # shared DTO/types/openapi
  docs/           # this proposal set + STATUS.md + runbooks
  deploy/         # docker/compose, k8s (later), CI workflows
  tests/          # e2e suites (Playwright)
```