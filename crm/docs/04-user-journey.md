# D. User Journey Map

Primary journeys, key screens, and success criteria. All mobile-first.

## 1. Onboarding (business owner, first visit)
1. Sign up (email + OTP or magic link).
2. Create business: name, industry, GSTIN (optional), currency.
3. Create first branch (name, city, address).
4. Invite team (emails/phones or skip).
5. Add products (entry or Excel import) or "Load sample data".
6. Connect WhatsApp (or use development mock) and GST (or skip).
7. Land on Dashboard.
   Success: complete in under 10 minutes, any SMB can self-serve.

## 2. Capture a lead (sales executive, inbound call)
1. Tap `+` (FAB) -> Add Lead.
2. Name, company, mobile (WhatsApp number autodetected if same).
3. Tap Save. Auto: duplicate check, owner assignment (round-robin or
   manager-set), lead scoring recompute, automation "new lead" actions.
   Success: lead saved in <= 30 seconds; shows on pipeline + owner's tasks.

## 3. Engage and follow up
1. From lead detail, tap Call (logs call activity on connect/complete).
2. Tap Schedule Follow-up: type (call/WhatsApp/visit), date/time, recurring.
3. At due time: in-app + push/WhatsApp reminder; overdue highlights.
   Success: call logged <= 10s; follow-up scheduled <= 10s.

## 4. Convert to a customer (win)
1. Pipeline kanban: drag opportunity WON (permission-controlled, audited).
2. System converts to Customer, closes opportunity, prompts Create Quote/Order.
   Success: conversion audited; customer 360 available.

## 5. Quote -> Order -> Invoice -> Payment
1. Create Quotation from customer/lead (products, discount, GST).
2. Send via WhatsApp/PDF. On ACCEPTED -> Convert to Order.
3. Order CONFIRMED notifies warehouse; inventory deduction at pack/dispatch.
4. Invoice ISSUED -> customer pays (partial allowed) -> PAID.
   Success: quote <= 60s after product selection; server-computed totals.

## 6. Deliver
1. Order DISPATCHED creates delivery record + events.
2. Delivery executive updates status and uploads POD; customer can view
   /track/[ref].
   Success: statuses and timestamps audited; customer notified.

## 7. Retain
1. Automation flags "no contact 3 days" -> follow-up task.
2. AI assistant answers "which customers overdue" and drafts follow-ups.
3. Campaigns (opt-in only) re-engage warm segments with unsubscribe.
   Success: no spam; consent respected.

## 8. Manage & analyse (owner/manager)
1. Dashboard shows revenue, pipeline, team, stock, outstanding by role.
2. Drill into reports with date/branch/salesperson filters, export CSV/Excel.
3. Export full tenant data (data ownership).
   Success: leadership decisions from a single screen.

## 9. Field sales (field executive)
1. Start day / check-in (GPS, timestamp).
2. Planned visits; tap STARTED at location; record outcome + photos.
3. Check-out; attendance summary.
   Success: visit <= 15s to create; location tracking opt-in and transparent.