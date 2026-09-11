# Q. Development Roadmap

Deliver incrementally; gate on tests, migrations, API contract, responsive UI,
authorization, tenant isolation. Do not advance with critical errors.

## Phase 1 - Foundation (DONE scope of this session)
- Auth (login/signup/forgot/verify via Supabase), middleware sessions
- Organization + Branch models; onboarding flow
- Users, roles, permissions; RBAC helpers; user_branches scoping
- Full Postgres schema + RLS migrations
- Design system + app shell (sidebar/topbar/bottom nav/FAB)
- Audit logging; .env.example; CI lint/typecheck/tests
- Deliverables A-Q docs

## Phase 2 - CRM Core (DONE scope of this session)
- Leads: list/filters/create/detail/timeline, assignment + bulk, dedupe, merge
- Pipeline: kanban with drag, weighted value, stage config
- Customers: list + detail (overview/activities/tabs), contacts
- Tasks & follow-ups: Today/Upcoming/Overdue/Completed, recurring, completion
- Activities: log call/meeting/note; unified timeline
- Demo seed (Sharma Distributors) + import/export foundation

## Phase 3 - Sales (BUILT scope of this session)
- Products: catalog list/new/detail/edit, categories (inline quick-add), SKU
- Quotations: list/filters/new (line items, server GST totals), detail with
  status flow (DRAFT→SENT→VIEWED→ACCEPTED/REJECTED/EXPIRED→CONVERTED), convert→order
- Orders: list/filters/new, detail with lifecycle
  (DRAFT→CONFIRMED→PROCESSING→PACKED→DISPATCHED→OUT_FOR_DELIVERY→DELIVERED, cancel),
  dispatch deducts stock via SALE ledger + creates delivery record + event
- Inventory: ledger (purchase/sale/transfer/adjust/damage, immutable) kept in
  sync with per-(warehouse,product) summary; low-stock flag; warehouses page;
  adjust/transfer/create-warehouse sheets (permission-gated)
- Doc numbering (QT-/ORD- per organization); audit on every mutation
- Remaining in P3: variants UI, pricing levels, product import/export

## Phase 4 - Operations
- Deliveries + events + POD + customer tracking page
- Invoices (status flow, partial payment, outstanding) + payments
- Field visits + check-in/out GPS + attendance + summaries

## Phase 5 - Communication
- NotificationProvider abstraction (+ mock), WhatsApp templates, messages
- Campaigns with consent + unsubscribe, campaign analytics
- Notification center + preferences, email templates

## Phase 6 - Intelligence
- AI assistant (tool-bounded, permission-aware, confirmations)
- AI lead scoring + AI catalogue generator (review-before-publish)
- Automation engine UI + worker (triggers/conditions/actions)

## Phase 7 - Analytics
- Widget library (KPI cards, charts), reports (sales/leads/activity/
  inventory/financial) with filters + CSV/Excel export
- Global search, full tenant data export

## Phase 8 - Hardening
- Security review + OWASP passes; rate limits; performance (caching, indexes)
- Observability (logs, metrics, health), webhook DLQ
- E2E suite completion, deployment (Docker/Vercel/Supabase), docs final pass

## Definition of Done per module
UI responsive · DB implemented · API validated · permissions enforced ·
errors/loading/empty states · audit where required · tests · E2E flow ·
documentation updated.

## Status tracker
- [x] Foundation (P1)
- [x] CRM Core (P2)
- [x] Sales (P3)      - core built; variants/pricing/import remain
- [ ] Operations (P4) - next (invoices/payments, delivery workflow, visits GPS)
- [ ] Operations (P4)
- [ ] Communication (P5)
- [ ] Intelligence (P6)
- [ ] Analytics (P7)
- [ ] Hardening (P8)