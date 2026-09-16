# Security Architecture

## 1. Threat model (top risks → controls)

| Threat | Attack surface | Controls |
|---|---|---|
| SQL injection | all queries | Parameterized queries/ORM; no string-built SQL; Prisma + raw SQL via `sql` template |
| XSS | product descriptions, reviews, CMS content | Output encoding, sanitize rich text (allowlist), CSP header, escape React rendering |
| CSRF | cookie-authenticated mutations | SameSite=Strict/Lax cookies, Bearer-first API, CSRF where cookies required |
| SSRF | image proxying, webhook fetch, file import | Allowlist destinations, no user-controlled URLs fetched server-side, network egress policy |
| Broken access control | admin APIs, order/user scoping | RBAC middleware per route + ownership checks; granular permissions |
| Credential stuffing / brute force | /auth/login, /auth/otp/verify | Rate limiting, exponential lockout, OTP attempt caps, CAPTCHA at high risk |
| Session attacks | refresh tokens | Rotating refresh + httpOnly + reuse detection (revoke on reuse) |
| API abuse | search, cart, checkout | Rate limits per key/user/IP, payload caps, request validation |
| File upload attacks | product images, KYC docs | MIME+extension+size+content sniffing, scan (ClamAV at scale), serve from separate domain, non-exec storage |
| Payment/price manipulation | checkout | Totals recomputed server-side; price snapshot bound to order; signed/validated webhooks |
| Coupon abuse | promotions | Server-side rules, redemption uniqueness, usage caps, abuse hooks |
| Account takeover | user accounts | Email/phone verification, OTP, anomaly hooks, alerting |
| Secrets exposure | repo/env | Environment variables + secret manager, no secrets in code, gitleaks in CI |
| Supply chain | npm deps | Lockfile, Dependabot/renovate, `npm audit`/OSV scan in CI |
| Data loss | DB, storage | Automated backups + PITR, object versioning, DR runbook, quarterly restore tests |

## 2. Authentication & session hardening

- Argon2id (or bcrypt cost-tuned) password hashing; never store plaintext.
- Access JWT 15m; refresh token stored hashed in DB, httpOnly+Secure+SameSite=Lax cookie,
  rotated on every use, reuse → revoke whole session + alert.
- OTP: delivered via SMS/email abstraction, hashed at rest, 5 min TTL, 5 attempts, rate-limited
  per phone/email/IP.
- Admin: 2FA (TOTP) support, login alerts, privileged-action confirmation, session list/revoke.
- Password reset: single-use token, expiry, invalidates sessions.

## 3. Transport & headers

- HTTPS-only (HSTS), TLS 1.2+.
- Headers: CSP, X-Content-Type-Options: nosniff, X-Frame-Options/CSP frame-ancestors, Referrer-
  Policy, Permissions-Policy, X-XSS-Protection (legacy). Reporting to Sentry/otel.

## 4. Payment security

- Never store raw PAN/CVV; gateway tokenized; PCI-DSS scope minimized (SAQ-A iframe).
- Webhook signature verification with provider secrets (constant-time compare); webhook replay
  protection via unique event_id; server-side status reconciliation job.
- Payment amount/sign/currency validated against order; capture only after stock reservation.
- Refunds go to original payment instrument; partial refunds supported; reconciliation nightly.

## 5. Application security requirements

- Validate input on server always (client-side is UX only). Limit/validate idempotency keys.
- Soft-delete + authorization on all admin resources; no mass assignment.
- Audit log (immutable) for: product/price/inventory changes, order/return/refund state changes,
  refund approvals, role/permission/coupon/settings changes → actor, action, resource, old/new
  value, timestamp, IP, UA.
- Secrets: never in source; .env.template documented; secret manager (Vercel/Render/GitHub
  encrypted secrets; later AWS Secrets Manager/Vault).

## 6. Fraud & abuse hooks (configurable, Phase 2+ implementation)

Rules flagged for review (never auto-block without thresholds + manual review queue):
multiple failed payments, coupon stacking/velocity, unusual order velocity/amounts, device/IP
anomaly, excessive returns, fake-review detection (velocity + verification), account-takeover
signals. Design: event stream → rule engine → risk score → action (allow/warn/review/block).

## 7. Compliance & privacy

- Collect minimum data; consent capture on registration/newsletter (GDPR/DPDP-ready).
- Data retention policy; right-to-erasure workflow (anonymize orders, delete PII profiles).
- Legal review required pre-launch (DPDP, terms, refund policy). Not legal advice.
- Children's data, dietary/health category data treated carefully (Health & Wellness category).

## 8. Ops security

- Least-privilege DB user per service; connection egress restricted; TLS to DB/Redis.
- CI gates: lint, types, unit, integration, e2e, dependency audits, secret scan, container scan.
- Deployment: preview environments, protected branches, PR review, rollback plan.
- Monitoring: auth failures, payment failures, rate-limit floods, job failures, anomaly metrics.