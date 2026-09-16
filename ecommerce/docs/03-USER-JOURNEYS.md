# User Journeys

## 1. Customer — First Purchase (Guest)

1. Lands on Home → searches "wireless headphones".
2. Autocomplete + suggestions; picks a product from results.
3. Filters by Brand/Price/Rating on PLP → opens PDP.
4. PDP: gallery, zoom, rating, MRP/discount, variant select (color), pincode check shows delivery ETA.
5. Add to cart → Cart page (qty, coupon, estimate) → Checkout as **guest**.
6. Enters delivery address (+ optional save to account via OTP at the end).
7. Sees delivery option + fee + tax + final total (all server-computed).
8. Pays: UPI → "Payment successful" → Order Confirmation page + email + SMS.
9. Order status journey in My Orders + tracking.
10. Post-delivery email asks for a review → writes 5★ review with images.

**Failure paths handled:** payment failed → recover/reselect payment, order stays payable;
item out of stock at checkout → cart invalidated with clear message; pincode unserviceable →
blocked with alternative option; coupon expired → removed with message.

## 2. Customer — Returning (Logged-in)

- Login (email/pw, OTP, remember-me). Dashboard shows orders, wishlist, addresses, coupons,
  loyalty points, notifications, recent views.
- Reorders from order history, uses saved address, 1-tap add-to-cart from wishlist.

## 3. Customer — Return & Refund

1. Order → Requests return (reason + photos).
2. Auto eligibility check vs category/product rules → approval + pickup scheduled.
3. Logistics picks up; inspection updates status; refund initiated → payment gateway refund →
   notification + status timeline visible throughout.

## 4. Admin (Catalog Manager)

1. Login with MFA (Phase 3) → dashboard.
2. Create category tree, attribute sets; bulk-import 500 products via CSV → validation report.
3. Fix 3 SKU errors, publish. Changes audited (who/what/when/old/new).

## 5. Admin (Operations / Order Manager)

- Daily queue: low-stock list, pending shipments, return approvals.
- Approves refund (permission `refund.approve`), triggers payment refund, event logged.

## 6. Admin (Marketing Manager)

- Creates campaign + coupon (rules engine) + homepage banner → schedule → monitor redemption
  and conversion in Reports.

## 7. Customer Support

- Ticket linked to order; sees full order/event history and payment status; internal notes;
  escalate with priority/SLA. Initiates return/refund actions subject to permissions.

## 8. Future Seller (Phase 7 — designed now)

1. Register seller account → KYC submission → review.
2. Store setup: profile, banner, policies.
3. List products (their catalog, their price/stock, commission previewed).
4. Fulfill orders; update inventory; handle returns; view payouts + settlement + analytics.

## 9. Super Admin

- Full control incl. roles/permissions, store settings (tax, shipping, payments, email), all
  modules, audit log review, environment/backup status in Phase 3+.