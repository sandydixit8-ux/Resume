# K. Integration Architecture

## Provider abstraction
All outbound communication goes through interfaces so real providers can
replace development mocks without touching business code.

```
NotificationProvider (interface)
├── send(payload)        -> provider_ref, status
├── template(id)         -> render
└── webhookHandler(event) -> normalized event
├── WhatsAppProvider     (WhatsApp Business Cloud API; env: WHATSAPP_API_URL/KEY)
├── EmailProvider        (env: EMAIL_API_KEY)
├── SMSProvider          (env: SMS_API_KEY)
└── PushProvider         (in-app + web push)

GSTProvider         (GSTIN validation; mock in dev)
EInvoiceProvider    (IRP e-invoice submit/cancel; mock in dev)
EWayBillProvider    (e-way bill generation; mock in dev)
LLMProvider         (AI assistant + scoring + catalogue; env: AI_API_KEY)
```

Selection at runtime from env (`INTEGRATION_WHATSAPP=mock|live`,
`INTEGRATION_GST=mock|live`). Mock providers return deterministic simulated
responses clearly labelled and never miswrite to real external systems.

## WhatsApp design
- Senders are notification-type-safe. Templates stored in DB
  (`message_templates`) with WhatsApp category + approval status.
- Inbound messages via verified webhook -> normalized `messages` row -> linked to
  customer/lead by phone lookup -> triggers automation.
- Consent: recipients must have opt-in (`opt_in_comms`), unsubscribe respected.
- Rate limiting per phone/day; error handling with job retry + DLQ.

## Payments
- Provider abstraction (Razorpay/CCAvenue later); now `payments` records with
  manual/UPI reference. Idempotency key required. Reconciliation report.

## Storage
- Supabase Storage (S3-compatible). Uploads validated by mime/size (max 10 MB).
- Metadata row in `documents`; binary never stored in Postgres.

## Webhooks
- Outbound registry (`webhooks`), HMAC signature (env secret), idempotency key
  per event, exponential retry, dead-letter queue, `webhook_logs` for each
  attempt.
- Inbound verified by signature; events normalized.

## Realtime
- Supabase Realtime for notifications + order/delivery status so mobile users
  see updates live. Falls back to polling.

## Key rule
Never hard-code credentials; never pass secrets to the browser. All integration
configuration in admin (toggles + env).