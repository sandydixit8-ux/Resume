# A. Product Requirements Document

## 1. Product summary

VyaparOne CRM is a multi-tenant, mobile-first SaaS that replaces the fragmented
mix of WhatsApp, Excel, phone calls and paper used by Indian SMBs to run sales.
It centralises the full customer journey in one system.

Core business journey:

```
CAPTURE → ASSIGN → ENGAGE → CONVERT → ORDER → DELIVER → RETAIN
```

## 2. Target users

- SMB owners / business operators
- Sales managers
- Sales executives (office & field)
- Field / delivery executives
- Warehouse managers
- Accountants
- Distributors, dealers, manufacturers, wholesalers, traders, service firms,
  multi-branch businesses.

## 3. Personas & goals

| Persona | Primary goals |
|---------|---------------|
| Business owner | See revenue, pipeline, team performance, stock, outstanding in one view. |
| Sales manager | Track team leads, follow-ups, visits, conversion; reassign work. |
| Sales executive | `≤30s` lead capture, `≤10s` call logging, follow-up and visit on mobile. |
| Warehouse manager | See orders to pack, live stock, dispatch. |
| Accountant | Invoice, payments, GST/e-invoice readiness, reports. |
| Customer (portal) | Track orders/deliveries, view invoices, reorder from catalogue. |

## 4. Core modules & priority

| Module | MVP | Priority |
|--------|-----|----------|
| Dashboard (role-based) | Yes | P0 |
| Leads + assignment + import + dedupe | Yes | P0 |
| Pipeline (Kanban + weighted value) | Yes | P0 |
| Follow-up engine (due/upcoming/overdue, recurring) | Yes | P0 |
| Customer 360 + contacts | Yes | P0 |
| Activities (call, meeting, visit, note, task) | Yes | P0 |
| Products + catalogue + AI catalogue | Yes | P1 |
| Quotations → Orders | Yes | P1 |
| Inventory ledger (immutable stock movement) | Yes | P1 |
| Invoices + payments + outstanding | Yes | P1 |
| Deliveries + customer tracking page | Yes | P2 |
| Field visits + attendance | Yes | P2 |
| WhatsApp/Business API abstraction (+ mock) | Yes | P2 |
| Marketing campaigns + consent | Yes | P3 |
| Automation engine (trigger → conditions → actions) | Yes | P3 |
| AI assistant + lead scoring | Yes | P3 |
| Reports & analytics | Yes | P3 |
| Multi-branch, RBAC, audit log | Yes | P0 (foundation) |
| GST / E-Invoice / E-Way Bill providers (mock in dev) | Scaffold | P3 |
| Customer portal | Scaffold | P3 |

## 5. Functional requirements (excerpts)

### 5.1 Lead management
- Fields: name, company, contact person, mobile, alternate mobile, email,
  WhatsApp number, address/city/state/pincode, source, campaign, product
  interest, value, score, priority, status, owner, branch, timestamps,
  next follow-up, notes, tags, attachments.
- Sources: Website, Facebook, WhatsApp, IndiaMART, Referral, Phone, Email,
  Walk-in, Import, Manual, API.
- Statuses: NEW, CONTACTED, QUALIFIED, PROPOSAL, NEGOTIATION, WON, LOST, NURTURE.
- Priorities: HOT, WARM, COLD.
- Operations: list, kanban, detail with timeline, assignment + bulk assignment,
  bulk status, bulk messaging (via provider), Excel/CSV import with preview and
  error report, duplicate detection (mobile/email), merge, transfer, notes,
  attachments, activity history. Every lead has an owner or an assignment queue.

### 5.2 Pipeline
- Configurable pipelines & stages; stage probability; expected close time.
- Views: Kanban, list, table, forecast. Drag between stages is
  permission-controlled and audited. `Weighted pipeline = value × probability`.

### 5.3 Follow-up engine
- Types: call, WhatsApp, meeting, visit, email, task, custom.
- Views: TODAY, UPCOMING, OVERDUE, COMPLETED. Recurring follow-ups and
  automation-triggered follow-ups ("no contact for 3 days → create follow-up").

### 5.4 Field sales & attendance
- Start day, check-in/out with GPS + timestamp, visits (PLANNED/STARTED/
  COMPLETED/MISSED/CANCELLED), notes, photos, outcomes, next visit.
- Attendance optional; monthly summary. Location tracking is opt-in, transparent,
  and configurable; no covert continuous tracking.

### 5.5 Quotation / Order / Invoice
- Quote statuses: DRAFT, SENT, VIEWED, ACCEPTED, REJECTED, EXPIRED, CONVERTED.
- Order lifecycle: DRAFT, CONFIRMED, PROCESSING, PACKED, DISPATCHED,
  OUT_FOR_DELIVERY, DELIVERED, CANCELLED, RETURNED.
- Invoice statuses: DRAFT, ISSUED, PARTIALLY_PAID, PAID, OVERDUE, CANCELLED.
- Totals and tax are server-calculated and validated. Quote → Order conversion.

### 5.6 Inventory
- Immutable `inventory_transactions` ledger: PURCHASE, SALE, RETURN,
  ADJUSTMENT, TRANSFER_IN, TRANSFER_OUT, DAMAGE. Never overwrite stock without
  a ledger row. Low-stock alerts, transfers, multi-warehouse.

### 5.7 Communication & WhatsApp
- Per-customer chronological timeline (calls, WhatsApp, email, meetings, visits,
  notes, tasks, system events) linked to customer/lead/opportunity/order.
- Provider abstraction: `NotificationProvider` with WhatsApp / Email / SMS /
  Push providers. Development mock provider. Credentials only via env secrets.

### 5.8 Marketing
- Campaigns, segments (customers/leads), templates, scheduling, analytics
  (sent/delivered/failed/read/responded/converted). Mandatory consent opt-in
  and unsubscribe. No spam tooling.

### 5.9 Automation engine
- `TRIGGER → CONDITIONS → ACTIONS`, admin-configurable rule set, audited.

### 5.10 AI
- Assistant (answers questions over authorised CRM data, destructive actions ask
  confirmation), lead scoring (0–100; HOT 80–100, WARM 50–79, COLD 0–49), AI
  catalogue generator (review-before-publish). Clearly labelled as
  recommendations, not guarantees. AI can never bypass permissions.

### 5.11 Reports
- Sales / activity / inventory / financial reports; date, branch, salesperson,
  product filters; CSV/Excel export; KPI cards + charts.

### 5.12 Billing & tenancy
- SaaS plans FREE/TRIAL, STARTER, GROWTH, BUSINESS, ENTERPRISE; centralised
  subscription entitlements and feature flags (never scattered limits).
- All business data belongs to the organization; reassignment on employee exit.

## 6. Non-functional requirements

- Mobile-first (320–430px), fully responsive desktop.
- `≤30s` lead creation, `≤10s` call log / follow-up, `≤15s` visit,
  `≤60s` quote/order after product selection.
- Server-side pagination; no unbounded client data loads; lazy loading,
  code splitting, caching, optimised queries.
- WCAG 2.x AA: keyboard nav, focus states, labels, contrast, error messages.
- SLOs: fast initial load; all mutating APIs audited; tenant isolation enforced
  by Postgres RLS in addition to app code.
- Accessibility of all UI; user-friendly errors; technical details logged server
  side.

## 7. Out of scope (MVP)

- Full GST/e-invoice/e-way bill live API (adapters + mocks only).
- Live WhatsApp Business API (abstraction + mock; env-driven).
- Voice input (architecture reserved; mocked).
- Mobile native apps (responsive PWA web app first).