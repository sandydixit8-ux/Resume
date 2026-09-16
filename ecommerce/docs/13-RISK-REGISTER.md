# Risk Register

Severity H/M/L, Likelihood H/M/L, Mitigation. Review quarterly; top risks reviewed at each phase gate.

## 1. Technical

| Risk | S/L | Mitigation |
|---|---|---|
| Over-engineering / premature microservices | H/M | Modular monolith; extraction only when justified (Phase 8) |
| Checkout/back office complexity delay | M/M | Server-side pricing engine in one module; rigorous integration tests; Phase gates |
| Inventory race/overselling | H/M | Transactional reservation `UPDATE..WHERE avail>=qty` + retry/backpressure |
| N+1 / slow catalog at scale | M/M | Indexes, keyset pagination, ISR/CDN, cache keys; replicas later |
| Search quality (typos/synonyms) on Postgres | M/H | pg_trgm/FTS MVP + Typesense Phase 6; search behind interface |
| Third-party outage (payment/logistics/SMS) | H/M | Abstraction + retries + DLQ + graceful degradation + monitoring + fallbacks |
| Data loss | H/L | PITR + daily backups + quarterly restore drills |
| Migrations breaking prod | M/M | Forward-only, backward-compatible-2-releases, gated deploys, preview/staging |

## 2. Business

| Risk | S/L | Mitigation |
|---|---|---|
| Product-market fit wrong (categories/assortment) | H/M | CMS-driven, cheap experiments; start small assortment, expand |
| Payment/compliance (India: Razorpay onboarding, GST) | H/M | Early provider onboarding + GST registration; legal review flagged |
| Thin categories / SEO cannibalization | M/M | Canonical + unique metadata; category descriptions enforced (data quality) |
| Inventory accuracy vs reality (manual ops) | M/M | Movements + adjustments + audit + cycle-count support |
| Competitor price pressure | M/M | Promotions/coupons engines, flash deals, analytics on margin |
| Legal/regulatory gaps (returns, liability, DPDP) | H/L | Configurable policies; professional legal review pre-launch (non-blocking architecture) |

## 3. Security

| Risk | S/L | Mitigation |
|---|---|---|
| Payment fraud / price manipulation | H/M | Server-side totals, signed webhooks, reconciliation, fraud hooks |
| Account takeover / credential stuffing | M/H | Rate limits, lockout, OTP caps, refresh rotation, alerts |
| Data breach / PII exposure | H/L | Least privilege, encryption in transit/at rest, audit, retention policy |
| Coupon abuse | M/H | Single-use redemption constraint, caps, velocity rules |
| SSRF/file upload attacks | M/L | Egress policy, upload validation, separate media domain |

## 4. Operational

| Risk | S/L | Mitigation |
|---|---|---|
| Refunds/returns become operationally heavy | M/H | Clear category-level rules, automation (eligibility → pickup → refund), dashboards |
| Logistics RTO/failed delivery | M/H | Shiprocket tracking + RTO flow; address/pincode validation at checkout |
| Support volume overwhelms | M/M | Self-serve order tracking + FAQ + ticket system + SLA defaults |
| Job backlog (email/images/index) | M/M | Queue monitoring + DLQ alerts + worker autoscale |

## 5. Scalability

| Risk | S/L | Mitigation |
|---|---|---|
| Unbounded growth of events/analytics | M/M | Partitioning by month; warehouse later; sampled metrics where acceptable |
| Single-DB bottleneck at 10x | M/H | Read replicas, caching, partitioning, then service extraction |
| Marketplace trust (fake sellers/reviews) | M/H | KYC, verified-purchase, moderation, fraud hooks built-in |
| Multi-currency/tax complexity added late | M/L | Currency/tax-class fields designed now; i18n deferred |

## 6. Top 5 to watch (now)

1. Payment gateway onboarding & tax/compliance.
2. Checkout correctness (money path) — highest-risk feature.
3. Inventory accuracy under concurrent load.
4. Search relevance at launch (quality bar).
5. Scope creep vs Phase gates (MVP discipline).