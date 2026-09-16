# Missing Decisions — Minimum Founder Input

Only decisions that materially affect the build are listed. Everything else we've assumed with
rationale. **Recommended defaults are marked ✓ — adopt them by silence; override explicitly.**

## Decided without founder (assumed, documented)

| Item | Assumption |
|---|---|
| Region/currency | India, INR, GST-configurable, UPI/COD support |
| Marketplace timing | Phase 7, post-MVP; schema ready now |
| Guest checkout | Enabled (no forced account) |
| Search provider | Postgres MVP → Typesense |
| Payments | Razorpay first, abstraction allows later |
| Logistics | Shiprocket first, abstraction allows later |
| Admin panel form | Separate Next.js app, same design system |
| Brand/domain | Placeholder "NexusCart"; rename later = config change |

## Decisions requested (founder)

| # | Decision | Options | Recommendation | Why | Cost/Complexity/Scale/Risk |
|---|---|---|---|---|---|
| D1 | MVP hosting | A. Managed (Render/Railway) ✓ / B. VPS (Hetzner) | **A** | Fastest to ship, zero-ops | A: ~$75–185/mo. B: ~$35–100/mo but more DevOps. Scale: both fine. Risk: low. |
| D2 | Launch payment providers | A. Razorpay only ✓ / B. Razorpay + Cashfree / C. Stripe (IN) | **A** | UPI+cards+COD+EMI in one API; cheapest onboarding | Cost: gateway fees only. Risk: single-provider dependency → abstraction mitigates. |
| D3 | COD enablement | A. Yes ✓ / B. Prepaid only | **A** | Indian purchase behavior; higher conversion | Operational risk RTO, higher cost; needed to compete. |
| D4 | Multi-vendor timeline | A. Phase 3+ / B. Phase 4+ / C. Phase 5+ ✓ / D. After MVP proven (Phase 7+)? | **C/D** | Keep MVP focus; schema ready | Cost: none now. Risk: 0 now. |
| D5 | Budget ceiling (first 12 mo) | A. $200/mo ✓ / B. $500/mo / C. open | **A** | Rightsizing | Controls infra creep. |
| D6 | KYC/legal partner | Needs legal counsel assignment | — | DPDP/compliance pre-launch | Legal requirement — not buildable without counsel. |

## Missing requirements you must clarify (short list)

1. Store name + primary brand voice (cosmetic but drives design tokens).
2. Initial assortment size at launch (affects import/data quality testing, not architecture).
3. Payment settlement: do you need invoicing for B2B sales (GST e-invoice) at launch? (B2B not in
   MVP matrix; invoice v1 = GST-compliant customer invoice.)
4. Any existing procurement/ERP systems to sync in Phase 4+?
5. Team/IQ constraints for the chosen stack (Node/TS experience vs Python) — affects D1/D2 only.

## Founder Decision Framework (used above)

Each option shows Recommendation / Why / Cost impact / Complexity / Scalability impact / Risk.
Final call is always the founder's.