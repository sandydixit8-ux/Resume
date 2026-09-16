# Business Architecture

Version: v0.1 (draft for review). Companion to `00-EXECUTIVE-OVERVIEW.md`.

---

## 1. Business Model

Phase now (MVP → Phase 5):
- **Merchant model:** company owns catalog, inventory, fulfillment. Revenue = product margin.
- Channel: web storefront only (apps later via same APIs).

Phase 6+ growth model:
- Marketplace commission on seller sales; listing fees; featured/promoted products; ad slots;
  logistics deduction; payment processing fee share; loyalty program.

Monetization features out of scope for MVP but their **data structures** (commission %, payout,
settlement) are designed into schema now to avoid a rewrite.

## 2. Operating Model

- **Single legal entity** operating the store, managing catalog + orders, paying itself no commission.
- Catalog management: dedicated catalog team via admin.
- Fulfillment: own warehouse + third-party logistics via integration.
- Support: in-house support team via ticket system.

## 3. Future Marketplace Evolution Model

The marketplace flow: Customer → Marketplace → Seller → Warehouse → Logistics → Customer.

Required capabilities (designed now, enabled later):

| Capability | Design today | Enabled |
|---|---|---|
| Product ownership per seller | `seller_id`, `seller_products` | Phase 7 |
| Seller registration + KYC | `sellers`, KYC fields | Phase 7 |
| Seller storefront | seller-scoped routes/API | Phase 7 |
| Seller commission | `commission_rate` on seller/merchant product | Phase 7 |
| Payouts & settlement | `seller_payouts`, settlement worker | Phase 7 |
| Order splitting (multi-seller cart) | `order` + `shipments` (1:N), split at checkout | Phase 7 |
| Reviews by seller + seller responses | `reviews.seller_id`, seller_response | Phase 7 |

Key architectural decision: **a product belongs to one owner** (merchant or seller). Single-store
today = every product owner is the merchant. No schema refactor needed to flip it on.

## 4. Revenue & Trust Model

- No fake reviews, no fake discounts (MRP vs selling price must reflect real list prices).
- Transparent return/refund policy configurable per category.
- Trust indicators: secure payment, delivery estimate, warranty, verified purchase tags.

## 5. Compliance Scope

- India-focused MVP: INR, GST-configurable tax rates, Indian pincode/phone/address, invoice
  generation, refund rules.
- Legal pages configurable in CMS (no code change to update policy).
- Flag for legal review: GDPR/DPDP compliance, terms, refund and liability disclaimers. We are
  not a lawyer; professional legal review is a pre-launch requirement.

## 6. Business Metrics That Matter (tracked from day one)

GMV, net revenue, orders, AOV, conversion rate, new vs returning customers, repeat purchase rate,
CAC, cart abandonment, returns rate, coupon redemption, refund rate, search-to-purchase rate.
See `08-API.md` (analytics module) and `12-DEVELOPMENT-PLAN.md` (Phase 6).