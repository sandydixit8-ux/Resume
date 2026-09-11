# F. Database Schema

PostgreSQL. UUID PKs, `organization_id` on every business-owned row, RLS
enabled on all tenant tables. Live SQL lives in `supabase/migrations/`. This
document is the normative summary.

## Conventions
- `id uuid primary key default gen_random_uuid()`
- `organization_id uuid not null references organizations(id)`
- `branch_id uuid null references branches(id)`
- `created_by/updated_by uuid null references users(id)`
- `created_at/updated_at timestamptz default now()`
- Indexes on every FK + `(organization_id, status)`, `(organization_id, created_at)`.
- Enums as Postgres `text` + CHECK where simple, or dedicated enum types.

## Core identity
- **organizations**: id, name, legal_name, gstin, industry, currency, logo_url,
  timezone, status, plan limits snapshot, created_at.
- **branches**: id, organization_id, name, code, address, city, state, pincode,
  phone, is_active.
- **users** (profiles keyed by Supabase auth): id (= auth.users.id), org_id,
  name, phone, avatar_url, is_active, last_seen_at.
- **roles**: id, organization_id, name, slug, description, is_system (bool),
  permissions (array or join row).
- **permissions**: id, organization_id, slug, description.
- **role_permissions**: role_id, permission_id, organization_id.
- **user_roles**: user_id, role_id, organization_id.
- **user_branches**: user_id, branch_id, organization_id.
- **invitations**: id, organization_id, email, phone, role, branch_ids,
  token, expires_at, accepted_at.

## CRM
- **lead_sources**: id, organization_id, name (Website, Facebook, WhatsApp,
  IndiaMART, Referral, Phone, Email, Walk-in, Import, Manual, API).
- **leads**: id, org_id, branch_id, lead_no, name, company, contact_person,
  mobile, alt_mobile, email, whatsapp_number, address, city, state, pincode,
  source, campaign, product_interest, value numeric, score int, priority
  (HOT/WARM/COLD), status, owner_id, last_contacted_at, next_followup_at,
  notes, tags text[], converted_customer_id, created_by, timestamps.
- **customers**: id, org_id, branch_id, customer_no, name, company, category,
  mobile, email, whatsapp_number, address, city, state, pincode, gstin,
  credit_limit, opt_in_comms bool, tags, assigned_to, timestamps.
- **customer_contacts**: id, customer_id, name, mobile, email, designation.
- **lead_activities**: id, lead_id, customer_id (nullable), activity_type
  (call/whatsapp/email/meeting/visit/note/task/system), summary, meta jsonb,
  performed_at, created_by.

## Pipeline
- **pipelines**: id, org_id, name, is_default, stages_order jsonb.
- **pipeline_stages**: id, pipeline_id, name, probability, expected_days,
  sort_order, is_winning(bool), is_losing(bool).
- **opportunities**: id, org_id, branch_id, lead_id, customer_id, pipeline_id,
  stage_id, name, value, probability, expected_close_date, owner_id,
  next_action_at, last_activity_at, status(WON/LOST/OPEN), closed_at,
  lost_reason, timestamps.

## Activity
- **tasks**: id, org_id, owner_id, subject, description, due_at, priority,
  status(TODO/IN_PROGRESS/DONE/CANCELLED), related_type/related_id.
- **followups**: id, org_id, lead_id/customer_id/opportunity_id (nullable),
  kind (call/whatsapp/meeting/visit/email/task/custom), due_at, remind_at,
  recurring (cron or interval), status(PENDING/DONE/SKIPPED/CANCELLED),
  context note, completed_at, created_by.
- **calls**: id, org_id, related_type/id, direction, duration, outcome,
  recording_url, logged_at, created_by.
- **meetings**: id, org_id, subject, related_type/id, starts_at, ends_at,
  location, outcome, created_by.
- **visits**: id, org_id, branch_id, customer_id, visit_by, status
  (PLANNED/STARTED/COMPLETED/MISSED/CANCELLED), purpose, scheduled_at,
  check_in_at, check_out_at, lat, lng, notes, outcome, photos jsonb,
  next_visit_at, timestamps.
- **attendance**: id, org_id, user_id, date, check_in_at, check_out_at,
  check_in_lat/lng, status (PRESENT/ABSENT/LATE/ON_LEAVE/FIELD_VISIT).

## Catalogue & inventory
- **product_categories**: id, org_id, name.
- **products**: id, org_id, sku, name, description, short_description, category,
  brand, unit, hsn_sac, tax_rate, purchase_price, selling_price, discount,
  min_stock, image_url, is_active, tags, attributes jsonb, is_ai_generated bool.
- **product_variants**: id, product_id, sku, attributes jsonb, purchase/sell.
- **warehouses**: id, org_id, branch_id, name, address.
- **inventory**: id, org_id, warehouse_id, product_id, quantity, low_stock_flag.
- **inventory_transactions** (immutable ledger): id, org_id, warehouse_id,
  product_id, type, quantity delta, ref_type/ref_id (order, purchase, etc.),
  balance_after, note, created_by, created_at.

## Transactions
- **quotations**: id, org_id, branch_id, quote_no, customer_id, lead_id,
  date, valid_until, salesperson_id, status, tax_amount, discount_amount,
  subtotal, total, terms, notes, converted_order_id, timestamps.
- **quotation_items**: id, quotation_id, product_id, qty, unit_price, discount,
  tax_rate, line_total.
- **orders**: id, org_id, branch_id, order_no, customer_id, salesperson_id,
  warehouse_id, delivery_address, delivery_date, status, payment_status,
  subtotal, discount, tax, total, quote_id, notes, timestamps.
- **order_items**: id, order_id, product_id, qty, unit_price, discount, tax,
  line_total, fulfilled_qty.
- **deliveries**: id, org_id, order_id, courier/driver, vehicle, tracking_no,
  address, expected_at, status(PENDING/ASSIGNED/PICKED/DISPATCHED/IN_TRANSIT/
  OUT_FOR_DELIVERY/DELIVERED/FAILED/RETURNED), delivered_at, proof_url,
  signature_url, notes.
- **delivery_events**: id, delivery_id, status, at, lat/lng, note, created_by.
- **invoices**: id, org_id, branch_id, invoice_no, customer_id, order_id,
  date, due_date, status(DRAFT/ISSUED/PARTIALLY_PAID/PAID/OVERDUE/CANCELLED),
  subtotal, discount, tax, total, paid_amount, gst breakdown, pdf_url,
  e_invoice refs(jsonb), timestamps.
- **invoice_items**: id, invoice_id, product_id, qty, unit_price, discount,
  tax_rate, line_total.
- **payments**: id, org_id, invoice_id, amount, method, reference, status,
  paid_at, partial flag, created_by.

## Communication & marketing
- **message_templates**: id, org_id, name, category, channel, body, variables,
  status; approval fields for WhatsApp templates.
- **messages**: id, org_id, related_type/id, direction, channel(whatsapp/email/
  sms/push), provider_id, to, body, template_id, status(sent/delivered/failed/
  read), provider_ref, error, sent_at.
- **campaigns**: id, org_id, name, channel, template_id, segment jsonb,
  schedule_at, status, metrics jsonb (sent/delivered/failed/read/responded/
  converted).
- **campaign_recipients**: id, campaign_id, recipient_type/recipient_id,
  consent bool, status, message_id.

## Automation & AI
- **automations**: id, org_id, name, is_active, trigger_type, trigger_config,
  conditions jsonb, actions jsonb, last_run_at, timestamps.
- **automation_runs**: id, automation_id, entity_type, entity_id, ran_at,
  success, error.
- **ai_jobs**: id, org_id, job_type, input jsonb, output jsonb, status, error.

## Notifications
- **notifications**: id, org_id, user_id, category, title, body, link,
  is_read, created_at.
- **notification_preferences**: user_id, channel, category, enabled.

## Audit & files
- **audit_logs**: id, org_id, user_id, action, entity, entity_id, old_value
  jsonb, new_value jsonb, ip, user_agent, created_at.
- **documents**: id, org_id, entity_type, entity_id, name, storage_path,
  mime, size, created_by.

## Platform
- **plans**: id, slug, name, limits jsonb, price.
- **subscriptions**: org_id, plan_id, status, started_at, renew_at,
  entitlements jsonb, limits snapshot.
- **feature_flags**: id, org_id, slug, enabled.
- **webhooks** / **webhook_logs**: outbound endpoints, signature, retries,
  last_response, dead-lettered flag.

**Indexes**: `(organization_id, status)`, `(organization_id, created_at)`,
`(organization_id, assigned/owner_id)`, `(organization_id, branch_id)`,
`(customer_id)`, `(lead_id)`, `(order_id)`, `(followups due_at)`,
`(opportunities expected_close_date)`.