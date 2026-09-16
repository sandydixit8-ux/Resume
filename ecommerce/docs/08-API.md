# API Architecture

REST over HTTPS, JSON, versioned `/api/v1`, OpenAPI-generated docs. Standard NestJS modules
mirror domain boundaries. Same API serves storefront web, admin web, and future mobile apps.

## 1. Conventions

- **Versioning:** URL segment `/api/v1` (break via `/api/v2` when needed).
- **Auth:** Bearer JWT access (15m) + rotating refresh token in httpOnly cookie (`/auth/refresh`).
  Admin uses stricter session policy.
- **Rate limiting:** per-route tiers (auth strict: 5–20/min; catalog lenient; admin medium).
- **Response envelope:** consistent `{ success, data, meta?, error? }`. Errors use RFC 7807-style
  `{ code, message, field_errors?, request_id }`.
- **Paginate:** cursor for large collections (`next_cursor`), `limit` cap 100; `meta.total`.
- **Idempotency:** client sends `Idempotency-Key` for order create, payment, refund, webhook
  handlers. Duplicates return the original result (200), never a second record.
- **Validation:** DTOs (class-validator) on every mutation; reject unknown/legacy fields.
- **Logging:** structured pino JSON with `request_id` propagated; audit hooks on sensitive ops.
- **Money:** numeric strings/decimals only; never float. Prices returned pre-formatted + raw.

## 2. Module → route map (all under `/api/v1`)

| Module | Key endpoints |
|---|---|
| `auth` | `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `POST /auth/otp/send`, `POST /auth/otp/verify`, `POST /auth/password-reset`, `POST /auth/me/password` |
| `users` | `GET/PATCH /users/me`, `GET /users/me/addresses`, `POST/PATCH/DELETE /users/me/addresses/:id`, `GET /users/me/orders`, `GET /users/me/reviews`, `GET /users/me/notifications` |
| `catalog` | `GET /categories`, `GET /categories/:slug/subtree`, `GET /products`, `GET /products/:slug`, `GET /products/:id/variants`, `GET /brands`, `GET /brands/:slug/products` |
| `attributes` | `GET /attributes?category=:id` (drive dynamic filters) |
| `search` | `GET /search?q=`, `GET /search/suggest?q=` (autocomplete) |
| `collections` | `GET /collections/:slug` (deals, new arrivals, best sellers, brand, etc.) |
| `cart` | `GET /cart`, `POST /cart/items`, `PATCH /cart/items/:id`, `DELETE /cart/items/:id`, `POST /cart/apply-coupon`, `DELETE /cart/coupon`, `POST /cart/save-for-later` |
| `checkout` | `POST /checkout/:sessionId/address`, `POST /checkout/:sessionId/delivery`, `POST /checkout/:sessionId/payment-intent`, `POST /checkout/place-order` (idempotent), `GET /checkout/:sessionId` |
| `payment` | `POST /payments/:id/verify`, gateway webhook: `POST /payments/webhooks/:provider`, `GET /payments/:id` |
| `orders` | `POST /orders/{id}/cancel`, `GET /orders/{id}`, `GET /orders/{id}/track`, `POST /orders/{id}/return-request`, `GET /orders/{id}/status-history`, `GET /delivery/estimate?pincode=` |
| `shipping` | `GET /shipping/serviceability?pincode=`, `GET /shipping/methods?addressId=` |
| `reviews` | `POST /products/:id/reviews`, `GET /products/:id/reviews`, `POST /reviews/:id/helpful`, `POST /reviews/:id/report`, `POST /reviews/:id/seller-response` (seller) |
| `wishlist` | `GET /wishlists`, `POST /wishlists`, `POST /wishlists/:id/items`, `DELETE /wishlists/:id/items/:itemId` |
| `recommendations` | `GET /recommendations/similar?product=`, `GET /recommendations/fbt?product=`, `GET /recommendations/trending`, `GET /recommendations/personalized`, `GET /recommendations/new-arrivals` |
| `notifications` | `GET /notifications`, `POST /notifications/:id/read`, `POST /notifications/read-all`, `POST /notifications/:id/preferences` |
| `content` | `GET /pages/:slug`, `GET /homepage` (config), `GET /faqs` |
| `admin` | `GET /admin/dashboard/metrics`, + CRUD: products, categories, brands, attributes, collections, orders, customers, coupons, campaigns, banners, warehouses, inventory, stock-movements, pages, faqs, roles, permissions, settings, reports/*, import (POST file → job → report), export |
| `analytics` | `POST /analytics/events` (client events), `GET /admin/reports/*` (admin) |
| `seller` (future) | `POST /seller/register`, `/seller/kyc`, `/seller/products`, `/seller/orders`, `/seller/inventory`, `/seller/payouts`, `/seller/analytics` |

## 3. Standard error codes

`AUTH_INVALID`, `AUTH_EXPIRED`, `AUTH_LOCKED`, `FORBIDDEN`, `VALIDATION_ERROR`,
`NOT_FOUND`, `CONFLICT`, `INVENTORY_UNAVAILABLE`, `COUPON_INVALID`, `COUPON_EXPIRED`,
`PAYMENT_FAILED`, `PAYMENT_REQUIRED`, `RATE_LIMITED`, `UNPROCESSABLE`, `INTERNAL_ERROR`.
Backend never leaks stack traces; `INTERNAL_ERROR` maps to logged request_id for support.

## 4. Idempotent operations (must list)

Order creation, payment intent + verification, webhook handling, refund creation, shipment
creation/release, coupon application. Implemented via unique keys + stored results.

## 5. Security requirements on API

Auth everywhere except public catalog/search/content; OWASP-rate-limit on auth; CSRF not an issue
with Bearer + same-site cookies (CSRF token on cookie-authenticated routes); strict CORS
(storefront/admin origins only); TLS only; upload endpoints verify MIME/extension/size/content;
admin operations logged to `audit_logs`.