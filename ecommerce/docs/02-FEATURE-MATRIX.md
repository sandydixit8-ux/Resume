# Feature Matrix

Capability grouped by release horizon. Legend: **✓ ship**, **( )** schema/prepared only, ƒ = future.
"Phase 2/3" here = post-MVP growth phases from `12-DEVELOPMENT-PLAN.md`, not the 3-step phases.

## A. Catalog & Discovery

| Feature | MVP | Phase 2 | Phase 3 | Marketplace |
|---|---|---|---|---|
| Hierarchical categories (C→SC→SSC→P), admin-managed | ✓ | | | |
| Dynamic category attributes / filters | ✓ | | | |
| Brands + brand pages | ✓ | | | |
| Products: SKU, variants, images, video, specs, warranty | ✓ | | | |
| Product SEO + structured data | ✓ | | | |
| Search: full-text, typo tolerance, synonyms, autocomplete | ✓ (Postgres) | ✓ (Typesense) | | |
| Search analytics + ranking feedback | | ✓ | | |
| Filters + sorting (dynamic per category) | ✓ | | | |
| Collections (curated / auto rules) | ✓ | | | |
| Compare products | | ✓ | | |
| Q&A on products | | ✓ | | |
| Product bulk import (CSV/Excel) | ✓ | | | |
| Bulk price/inventory/category update | ✓ | | | |

## B. Commerce

| Feature | MVP | Phase 2 | Phase 3 | Marketplace |
|---|---|---|---|---|
| Cart (guest + logged-in, persist, qty validation) | ✓ | | | |
| Save for later / price-drop & back-in-stock notify | | ✓ | | |
| Checkout (address → delivery → summary → coupon → payment) | ✓ | | | |
| Guest checkout (no forced account) | ✓ | | | |
| Multiple saved addresses + validation | ✓ | | | |
| Payment abstraction (UPI, cards, netbanking, wallets, COD, EMI, links) | ✓ (Razorpay) | | | |
| Payment idempotency + webhook signature + refunds | ✓ | | | |
| Orders: lifecycle, event history, audit | ✓ | | | |
| Returns / refunds (request → inv → refund; replacement/exchange) | ✓ | | | |
| Order splitting / multi-shipment | ( ) | | | ✓ |
| EMI display | ✓ (if provider) | | | |

## C. Operations

| Feature | MVP | Phase 2 | Phase 3 | Marketplace |
|---|---|---|---|---|
| Inventory reservation (transactional, race-safe) | ✓ | | | |
| Warehouse + stock movement + low-stock alerts | ✓ | | | |
| Shipping abstraction + zones + pincode serviceability | ✓ | | | |
| Logistics provider #1 integration (Shiprocket) | ✓ | | | |
| Tracking + AWB + failed/RTO handling | | ✓ | | |
| Delivery estimation engine | ✓ (estimate) | ✓ (provider ETA) | | |
| Invoice generation | ✓ | | | |

## D. Growth & Marketing

| Feature | MVP | Phase 2 | Phase 3 | Marketplace |
|---|---|---|---|---|
| Coupons & promotions (rules engine) | ✓ | | | |
| Banners + homepage CMS sections | ✓ | | | |
| Reviews & ratings (verified, moderation) | ✓ | | | |
| Notifications (email/SMS/push architecture) | ✓ (email/SMS) | ✓ (push) | | |
| Wishlists | ✓ | multiple | | |
| Recommendations (rule-based FBT/similar/trending) | ✓ | | | ML later |
| Loyalty points / referrals / membership | | ✓ | | |
| Abandoned cart recovery | | ✓ | | |
| Flash sales / deals / new arrivals / best sellers pages | ✓ | | | |
| SEO: sitemaps, schema, canonical, OG | ✓ | | | |

## E. Admin & Platform

| Feature | MVP | Phase 2 | Phase 3 | Marketplace |
|---|---|---|---|---|
| Admin dashboard + metrics | ✓ | | | |
| Catalog / orders / customers / inventory / marketing modules | ✓ | | | |
| RBAC + granular permissions + audit log | ✓ | | | |
| CMS: homepage, banners, pages, FAQs | ✓ | | | |
| Reports (sales, products, customers) | ✓ | | | |
| Support ticket system | | ✓ | | |
| Multi-currency / i18n | | | ✓ | |
| Seller registration, KYC, storefront, dashboard | | | | ✓ |
| Payouts, settlement, commission | | | | ✓ |

## F. Platform / Non-functional

| Feature | MVP | Phase 2 | Phase 3 | Marketplace |
|---|---|---|---|---|
| Auth: email+pw, OTP, refresh tokens, reset, lockout | ✓ | social OAuth | MFA (admin) | |
| Structured logging, error tracing | ✓ (pino/Sentry) | Prometheus/Grafana | | |
| Rate limiting, security headers, audit | ✓ | | | |
| Background jobs (email, image, index, sync) | ✓ | | | |
| Caching (Redis + HTTP/CDN) | ✓ | | | |
| Backups + DR + restore testing | ✓ | | | |
| API docs (OpenAPI), versioning | ✓ | | | |
| E2E test suite + CI/CD gates | ✓ | | | |
| AI features (recs, assistant, forecasting) hooks | ( ) | | | ✓ |