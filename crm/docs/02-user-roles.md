# B. User Roles Matrix

| Role | Scope | Responsibilities |
|------|-------|-------------------|
| SUPER ADMIN | Platform | All tenants, organisations, subscriptions, system health, support access (audited). Not casual tenant data access. |
| BUSINESS OWNER | Org-wide | All business settings, users, branches, plans, reports, data export, reassignment, viewing all branches/teams. |
| ADMIN | Org-wide (all branches) | Like owner minus billing/subscription ownership; manages users, roles, catalogues, automation. |
| SALES MANAGER | Assigned branches/teams | Team performance, lead assignment, pipeline management, approvals, reports. |
| SALES EXECUTIVE | Own records + shared | Create/edit leads, log activities, follow-ups, quotes, orders for own league; view shared. |
| FIELD EXECUTIVE | Own | Visits, check-in/out, attendance, visit notes/photos/outcomes. |
| WAREHOUSE MANAGER | Warehouse(s) | Inventory, stock movement, picking, packing, dispatch. |
| DELIVERY EXECUTIVE | Deliveries | Delivery updates, POD. |
| ACCOUNTANT | Org finance | Invoices, payments, outstanding, GST readiness, financial reports. |
| CUSTOMER | Own account (portal) | View orders/deliveries/invoices, place orders, download documents. |

Hierarchy and inheritance:

- `SUPER ADMIN` (platform) → not a tenant role.
- `BUSINESS OWNER` highest tenant role; created with the first signup.
- `ADMIN` below owner; can manage most org settings.
- Functional roles below admin. A user may have multiple roles.
- Users may belong to one branch, multiple branches, or be org-wide.

Role ↔ branch data visibility:

- Owner/Admin/Accountant: org-wide (all branches by default).
- Sales Manager: branches to which they are attached.
- Sales/Field executives: their branch; records assigned to them plus
  org-shared records they are permitted to see.
- Warehouse/delivery: warehouse/branch scope.

See [08-rbac-matrix.md](./08-rbac-matrix.md) for granular permissions.