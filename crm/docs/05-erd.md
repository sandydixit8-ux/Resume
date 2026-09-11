# E. Database ERD

Simplified entity diagram. Every business-owned table carries
`organization_id`; most also carry `branch_id`, `created_by`, `updated_by`,
`created_at`, `updated_at`. UUID primary keys. Foreign keys enforce integrity.

```
organization 1---n branch 1---n [users][leads][customers][orders][inventory]...
organization 1---n user                (user belongs to org; 1..n roles)
branch 1---n user_branch              (many-to-many)
user 1---n user_role 1---n role 1---n role_permission 1---n permission

customer 1---n customer_contact
customer 1---n lead
customer 1---n opportunity
customer 1---n quotation 1---n quotation_item
customer 1---n order 1---n order_item
order 1---n delivery 1---n delivery_event
customer 1---n invoice 1---n invoice_item / payment
order 1---n payment 1---n invoice_payment (optional join)

lead 1---n lead_activity
lead 1---n opportunity
opportunity 1---n task / followup
task/followup --> user, lead/opportunity/customer
followup 1---n followup_reminder (optional)

product 1---n product_variant ; product n---1 product_category
product 1---n inventory (per warehouse) ; product 1---n inventory_transaction
inventory_transaction types: PURCHASE SALE RETURN ADJUSTMENT TRANSFER_IN
                             TRANSFER_OUT DAMAGE

quotation 1---n quotation_item(n product)
order 1---n order_item(n product)
invoice n---n order (nullable join)
invoice_item

campaign 1---n campaign_recipient(n customer/lead)
message_template ; message (outbound/inbound, provider type)
notification 1---n user ; notification_preference

automation 1---n automation_rule (trigger json, conditions json, actions json)
document / attachment (poly: entity_type+entity_id)
audit_log (user, action, entity, entity_id, old/new json)
subscription (org) ; feature_flag ; plan
```

Key groups:

- **Identity/tenancy**: organizations, branches, users, user_types, roles,
  permissions, user_roles, user_branches, invitations.
- **Pipeline**: pipelines, pipeline_stages, opportunities, opportunity_activities.
- **CRM**: leads, lead_sources, lead_activities, customers, customer_contacts.
- **Activity**: tasks, followups, calls, meetings, visits, attendance.
- **Catalogue**: products, product_categories, product_variants.
- **Inventory**: warehouses, inventory, inventory_transactions.
- **Transactions**: quotations(+items), orders(+items), invoices(+items),
  payments, deliveries(+events).
- **Comms**: message_templates, messages, campaigns, campaign_recipients,
  notifications, notification_preferences.
- **Automation/AI**: automations, automation_rules, ai_jobs.
- **Audit/files**: audit_logs, documents, attachments.
- **Platform**: plans, subscriptions, entitlements, feature_flags.