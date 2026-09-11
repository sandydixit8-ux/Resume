# G. API Specification

REST (plus Next.js server actions for same-origin mutations). Versioned under
`/api/v1/*`. Consistent envelope:

```json
{
  "data": {},
  "meta": { "page": 1, "pageSize": 50, "total": 120 },
  "error": null
}
```

Errors:
```json
{
  "data": null,
  "error": { "code": "VALIDATION", "message": "Mobile number is required",
             "field": "mobile" }
}
```

## Auth
- `POST /api/v1/auth/login` (email+password) -> tokens + profile
- `POST /api/v1/auth/signup` (email, password, name, org name)
- `POST /api/v1/auth/refresh` (refresh token rotation)
- `POST /api/v1/auth/forgot-password`
- `POST /api/v1/auth/verify-otp`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`

## Tenancy & org
- `GET/PATCH /api/v1/organizations/:id` (settings, GST, industry, currency)
- `GET/POST /api/v1/branches`
- `GET/PATCH /api/v1/branches/:id`
- `GET/POST /api/v1/users` · `PATCH /api/v1/users/:id` · `POST /api/v1/users/invite`
- `GET/POST /api/v1/roles` · `PATCH /api/v1/roles/:id`
- `GET /api/v1/onboarding/status` · `POST /api/v1/onboarding/complete`

## CRM
- Leads: `GET /api/v1/leads` (filters: status, priority, source, owner,
  branch, search, tags; sort; paginate) · `POST /api/v1/leads`
  · `GET/PATCH /api/v1/leads/:id` · `DELETE /api/v1/leads/:id` (soft)
  · `POST /api/v1/leads/bulk-assign` · `POST /api/v1/leads/bulk-status`
  · `POST /api/v1/leads/:id/merge` · `POST /api/v1/leads/import`
- Customers: `GET/POST /api/v1/customers` · `GET/PATCH /api/v1/customers/:id`
  · `POST /api/v1/customers/:id/contacts`
- Opportunities: `GET/POST /api/v1/opportunities` · `PATCH /api/v1/opportunities/:id/move`
- Pipelines: `GET/POST /api/v1/pipelines` · `GET/PATCH /api/v1/pipelines/:id/stages`
- Activities: `POST /api/v1/activities/call` · `POST /api/v1/activities/meeting`
  · `POST /api/v1/activities/note`
- Tasks/follow-ups: `GET /api/v1/tasks?view=today|upcoming|overdue|completed`
  · `POST/PATCH /api/v1/tasks` · `GET/POST /api/v1/followups`
  · `PATCH /api/v1/followups/:id/complete`

## Field sales
- `POST /api/v1/visits` · `PATCH /api/v1/visits/:id/checkin` (lat/lng)
  · `PATCH /api/v1/visits/:id/checkout` · `POST /api/v1/attendance/checkin`
  · `POST /api/v1/attendance/checkout`

## Catalogue & inventory
- `GET/POST /api/v1/products` · `GET/PATCH /api/v1/products/:id`
- `POST /api/v1/products/:id/ai-generate`
- `GET /api/v1/inventory?warehouse=` · `POST /api/v1/inventory/adjust`
- `POST /api/v1/inventory/transfer`
- `GET /api/v1/inventory/transactions?product=`

## Transactions
- `GET/POST /api/v1/quotations` · `PATCH /api/v1/quotations/:id`
  · `POST /api/v1/quotations/:id/send` · `POST /api/v1/quotations/:id/convert`
- `GET/POST /api/v1/orders` · `GET/PATCH /api/v1/orders/:id`
  (status transitions gated) · `POST /api/v1/orders/:id/cancel`
- `GET/POST /api/v1/deliveries` · `PATCH /api/v1/deliveries/:id/events`
- `GET/POST /api/v1/invoices` · `POST /api/v1/invoices/:id/pay`
- `GET /api/v1/payments` · `GET /api/v1/reports/outstanding`

## Comms / marketing / automation / AI
- `GET/POST /api/v1/messages` (via provider abstraction)
- `GET/POST /api/v1/templates`
- `GET/POST /api/v1/campaigns` · `POST /api/v1/campaigns/:id/send`
- `POST /api/v1/automations` · `GET/PATCH /api/v1/automations/:id` · `POST .../run`
- `POST /api/v1/ai/assistant` · `GET /api/v1/ai/insights`
- `POST /api/v1/export/:entity` (CSV/Excel, async job)
- `POST /api/v1/webhooks/inbound` · Webhook outbound registry under `/api/v1/webhooks`

## Reports
- `GET /api/v1/reports/sales?from=&to=&branch=&salesperson=&product=`
- `GET /api/v1/reports/leads`
- `GET /api/v1/reports/activity`
- `GET /api/v1/reports/inventory`
- `GET /api/v1/reports/financial`

## Conventions
- Auth: `Authorization: Bearer <JWT>`; CSRF protection for cookie sessions.
- Pagination: `?page=1&pageSize=50` (max 100).
- Filtering: `?status=WON&priority=HOT`.
- Sorting: `?sort=-score` (`-` = desc).
- Tenancy: server resolves org from session; tenant id is never client-supplied.
- Concurrency: optimistic locking via `updated_at`/version where needed.
- Idempotency: `Idempotency-Key` header for payments/campaign sends.
- Rate limiting on auth, WhatsApp send, AI endpoints.