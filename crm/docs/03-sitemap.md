# C. Complete Sitemap

## Auth
- /login
- /signup
- /forgot-password
- /verify (OTP / verification)

## Onboarding
- /onboarding/business (Business Setup)
- /onboarding/branch (Branch Setup)
- /onboarding/team (Invite Team)
- /onboarding/products (Product Setup)
- /onboarding/import (Import Data)
- /onboarding/complete (lands on dashboard)

## App shell (authed)
Desktop: sidebar + top header + main area.
Mobile: bottom nav + contextual menus + Floating Action Button.

Mobile bottom nav: Dashboard, Leads, Customers, Tasks, Orders, More.

FAB quick actions: Add Lead, Add Customer, Add Follow-up, Log Call,
Create Visit, Create Quote, Create Order.

## Core
| Route | Screen |
|-------|--------|
| / | Dashboard (role-based widgets) |
| /leads | Leads (list + filters) |
| /leads/new | Add lead |
| /leads/[id] | Lead detail |
| /pipeline | Pipeline (kanban / list / forecast) |
| /customers | Customers |
| /customers/[id] | Customer detail (360) |
| /activities | Activities log |
| /tasks | Tasks & follow-ups (Today/Upcoming/Overdue/Completed) |
| /calendar | Calendar |
| /visits | Field visits |
| /attendance | Attendance |

## Sales
- /quotations, /quotations/[id]
- /orders, /orders/[id]
- /deliveries
- /track/[ref] (customer-facing tracking)

## Inventory
- /products, /products/[id]
- /inventory
- /warehouses
- /stock-movement

## Finance
- /invoices, /invoices/[id]
- /payments
- /outstanding

## Marketing
- /campaigns, /campaigns/[id]
- /templates (WhatsApp templates)

## Catalogue
- /catalogue
- /catalogue/builder
- /catalogue/ai (AI generator)

## Reporting
- /reports (sales / leads / activity / inventory / financial)

## Admin
- /admin/users
- /admin/roles
- /admin/branches
- /admin/integrations
- /admin/automation
- /admin/notifications
- /admin/settings
- /admin/audit
- /admin/subscription

## AI
- /assistant (AI Assistant)
- /insights (AI Insights)

## Customer portal
- /portal (customer dashboard)
- /track/[ref] (order tracking)

## Platform (super admin, separate area)
- /platform/organizations
- /platform/subscriptions
- /platform/health
- /platform/support