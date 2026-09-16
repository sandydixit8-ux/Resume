# Cost Estimation

Currency: approximate USD (and INR) monthly. Assumes low-ops managed services for MVP. Prices are
indicative 2026 street rates — verify at procurement. Two paths for MVP infra to let the founder
pick.

## 1. MVP monthly — Option A: Managed (fastest to ship)

| Item | Choice | Approx USD/mo |
|---|---|---|
| Web + API + worker hosting | Render/Railway (2 services + worker) | $20–40 |
| Managed PostgreSQL | 2 vCPU / 8 GB (starter) + PITR | $25–50 |
| Managed Redis | micro/0.5GB | $5–10 |
| Object storage + CDN | Cloudflare R2 (pay for use) + CF CDN | $2–10 |
| Email | Resend/SES | $5–20 |
| SMS | MSG91 | $2–10 (pay per use) |
| Payments | Razorpay (per-transaction fees, not infra) | $0 fixed |
| Logistics | Shiprocket (per-shipment, not infra) | $0 fixed |
| Monitoring | Sentry Starter + UptimeRobot | $15–25 |
| CI (GH Actions) | included/free tier + runners | $0–20 |
| **Total (managed)** | | **$75–185/mo (~₹7k–16k)** |

## 2. MVP monthly — Option B: VPS (cheapest)

| Item | Choice | Approx USD/mo |
|---|---|---|
| Web+API+worker | 1×Hetzner CX32/CPX31 (or 2 small) | $10–20 |
| Managed Postgres | Neon/ScaleGrid/Supabase small | $0–25 |
| Managed Redis | Upstash/Redis Cloud free–small | $0–5 |
| Storage/CDN | R2 + CF | $2–10 |
| Email/SMS/monitoring | same as Option A | $20–40 |
| **Total (VPS mix)** | | **$35–100/mo (~₹3k–9k)** |

One-time: ~$150–300 for integrations setup, SSL, DNS/mail (negligible).

**Recommendation:** Option B if infrastructure skills are in-house; Option A if we want zero-ops
and faster iteration. Non-blocking for architecture (identical code, different deploy target).

## 3. Variable unit costs (scale from day 1)

- Razorpay aggregate fees (UPI/cards/netbanking/wallet ≈ 1.5–2% + GST often; card network fees).
- Shiprocket prepaid ~₹35–90/shipment; COD higher + COD COD charges.
- SMS ~₹0.15–0.25/message (uptime/transactional).
- CDN egress: R2 free egress → CDN near $0.

## 4. Scale infrastructure estimate (Phase 6+)

| Item | Estimate when relevant |
|---|---|
| Database primary+replica | $200–800/mo (Postgres 4–16 vCPU) |
| Redis cluster / cache | $50–200/mo |
| Typesense (2–3 nodes) | $100–400/mo (SaaS) or self-host VPS |
| Search/k8s/queue infra | $500–2,000/mo when traffic >1M MAU |
| Event pipeline + warehouse | $500–2,500/mo (managed Kafka/infra + BigQuery/ClickHouse) |
| CDN + storage | grows with image traffic, $50–500/mo |

Budget rule: rightsize to traffic each quarter; keep MVP under ~$200/mo total until revenue
justifies spending.