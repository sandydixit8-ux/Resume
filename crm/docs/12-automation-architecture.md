# L. Automation Architecture

Generic rule engine: `TRIGGER -> CONDITIONS -> ACTIONS`. Rules are rows in
`automations` (admin-configurable), executed by a job worker; hours-long tasks
never block the API request that enqueues them.

## Rule model
- trigger_type + trigger_config: e.g.
  `lead.created`, `lead.stale(3d)`, `quotation.accepted`, `order.confirmed`,
  `order.dispatched`, `inventory.low`, `payment.received`, `visit.missed`,
  `campaign.replied`, or scheduled `cron`.
- conditions (jsonb): field comparisons on the entity + org context, e.g.
  `{ "field": "value", "op": ">=", "value": 500000 }`, `priority = HOT`.
- actions (jsonb): one or many, run in order:
  - `assign.user{ mode: round_robin|owner|role, role: sales_manager }`
  - `followup.create{ kind, offset }`
  - `notify.user{ role | user }`
  - `message.send{ template }`  (respect consent)
  - `order.status{ status, on: activity }`
  - `webhook.emit{ event }`
  - `log` (audit)

## Execution
1. Business event -> `enqueueAutomation(eventType, entity)` (DB queue table or
   bg job).
2. Worker loads active rules (cached), evaluates conditions inside a matching
   tenancy context, executes actions transactionally with `automation_runs`
   row for tracing.
3. Idempotent: each `(automation_id, entity_type, entity_id, trigger)` executes
   once; guard on partial failures.

## Example rules (seeded)
- New lead -> assign round-robin to sales team + welcome WhatsApp (if opted in).
- Lead not contacted 3 days -> follow-up task to owner.
- Quotation accepted -> create order draft.
- Order confirmed -> notify warehouse (category=pending orders).
- Order dispatched -> notify customer (delivery tracking link).
- Stock < min -> notify inventory manager.
- Opportunity inactive 7 days & value > X -> notify sales manager.

## Guardrails
- No message-sending automation without recipient consent (anti-spam).
- Deterministic evaluation; condition failures stop the run and log reason.
- Owner can pause rules from admin; audit logs rule toggles.