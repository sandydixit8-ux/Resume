# H. RBAC Matrix

Granular permission slugs in the form `entity.action`. Roles bundle a set of
permissions; custom roles allowed. Definitions in DB `permissions` + `roles`
tables; enforcement in server actions and RLS.

## Permission slugs (namespace.entity.action)
- `lead.*`: view, create, edit, delete, assign, export, convert, merge, import
- `customer.*`: view, create, edit, delete, export
- `opportunity.*`: view, create, edit, move, close, delete
- `task.*` / `followup.*`: view, create, edit, complete, delete
- `activity.*`: view, log, delete
- `visit.*`: view, create, checkin, checkout, manage
- `attendance.*`: view, checkin, checkout, manage
- `product.*`: view, create, edit, delete, import, ai-generate
- `inventory.*`: view, adjust, transfer, create_transaction
- `quotation.*`: view, create, edit, send, convert, delete
- `order.*`: view, create, edit, approve, cancel, dispatch
- `delivery.*`: view, create, update (POD), cancel
- `invoice.*`: view, create, edit, pay, cancel, export
- `payment.*`: view, record, refund
- `report.*`: view, export
- `campaign.*`: view, create, send, manage_consent
- `automation.*`: view, create, edit, toggle, run
- `notification.*`: view, manage_prefs, send
- `admin.*`: users, roles, branches, settings, integrations, subscription,
  audit view
- `audit.view`
- `ai.*`: assistant, insights, scoring, catalogue

## Role -> permission summary

| Slug | Permission grants (summary) | Data scope |
|------|------------------------------|-----------|
| owner | all `*` (except platform super-admin) incl. subscription, export | org-wide, all branches |
| admin | all except subscription.billing; owns users/roles/branches/settings | org-wide, all branches |
| sales_manager | lead.* (all), customer.*, opportunity.*, task/followup.*, activity.*, visit.* (manage/checkin), product.view, quotation.*, order.* (approve), report.view, automation.view | assigned branches, all records in those branches |
| sales_executive | lead.view/create/edit/convert/merge; customer.view/create/edit; opportunity view/create/edit/move; task/followup.*; activity.log; visit create/checkin/checkout; quotation view/create/send; order view/create; product.view | own records + branch-assigned records |
| field_executive | lead.view; customer.view; visit.* (checkin/checkout/create); attendance.checkin/checkout; activity.log | self + branch |
| warehouse_manager | order.view (processing), inventory.* , product.view, delivery update (pick/pack/dispatch) | warehouse(s) |
| delivery_executive | delivery.view/update; order.view | assigned deliveries |
| accountant | invoice.*, payment.*, report.view/export, outstanding, customer.view | org-wide |
| customer | portal: order.view, delivery.view, invoice.view, own profile, order.create (self-service) | own records only |

## Enforcement layers
1. **Server actions / API routes**: check `hasPermission(user, 'lead.edit')`
   before mutation.
2. **RLS policies**: user may read rows where
   `organization_id = user_org` AND
   (`branch scope` allowed) AND (`owner = me OR hasPermission(org, view_all)`).
   RLS never trusts client ids.
3. **UI**: buttons/links conditionally rendered by permission to reduce clutter;
   server still enforces.

Principle: UI hiding is convenience; the API + RLS are the source of truth.