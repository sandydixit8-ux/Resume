# P. Testing Strategy

## Layers
1. **Unit (Vitest)**: business logic only - tax calc (CGST/SGST/IGST), lead
   scoring buckets, weighted pipeline, provider selection, zod validation,
   idempotency keys, date/overdue helpers.
2. **Integration (Vitest + test Supabase project)**: auth register/login, org
   creation, create lead -> assign -> follow-up -> call -> convert, quote ->
   order -> inventory deduction -> invoice -> payment -> dispatch -> deliver.
   RLS/tenant isolation (user of org A cannot read org B), role permission
   enforcement, duplicate lead detection, invalid input rejected 4xx, provider
   failure surfaces friendly error and logs.
3. **E2E (Playwright)**: critical workflows from UI - signup -> org -> branch ->
   user -> lead -> assign -> followup -> call -> convert -> quotation -> order ->
   inventory deduct -> invoice -> payment -> dispatch -> deliver. Plus
   unauthorized access redirect, mobile viewport flows (320px), keyboard-only
   navigation.

## Mandatory flows (from spec)
Sign up, create organization, branch, user, lead, assign lead, schedule
follow-up, log call, convert lead, create quotation, convert to order, deduct
inventory, create invoice, record payment, dispatch order, complete delivery.
Also test unauthorized access, tenant isolation, role permissions, duplicate
leads, invalid input, API failure, network failure, WhatsApp failure, payment
failure.

## Test matrix highlights
| Concern | Test type | Example |
|---------|-----------|---------|
| Tenant isolation | Integration | Org A user 403/empty on org B resources |
| RBAC | Integration/Unit | view-all vs own-scope queries |
| Server-calculated totals | Unit/Integration | tampered subtotal ignored |
| Immutable stock ledger | Integration | adjustment requires transaction row |
| Duplicate leads | Integration | same mobile+name flagged |
| Audit trail | Integration | mutation writes audit row |
| Provider failure | Unit/Integration | WhatsApp down -> queued + retry + friendly error |
| Pagination | Integration | never returns > pageSize |
| Accessibility | E2E | keyboard nav + focus |
| Responsive | E2E | 320/375/390/430 widths |

## Tooling
- `npm run test` (vitest) for unit+integration; `npm run test:e2e` (Playwright).
- Code coverage gate on business libs.
- Run on PR via CI; blocking for phase completion (Definition of Done).