# Sitemap & Page Architecture

Groups list the canonical route. Dynamic segments in `{}`. All pages SSD/CSR hybrid via Next.js
with ISR where content is mostly static (catalog pages), client data for personal/cart state.
Categories are **never static routes** — `/categories/{slug}` / `/categories/{slug}/{sub}/{sub2}`
derive from DB.

## 1. Public Storefront (`/`)

| Route | Page |
|---|---|
| `/` | Home (CMS-driven sections) |
| `/products` | All products (filters + sort) |
| `/categories/{slug}` | Category (dynamic attributes, filters, SEO meta) |
| `/categories/{slug}/{sub}` | Subcategory |
| `/categories/{slug}/{sub}/{sub2}` | Sub-subcategory |
| `/product/{slug}` | Product details |
| `/search?q=` | Search results |
| `/deals`, `/flash-sale`, `/new-arrivals`, `/best-sellers` | Curated collections |
| `/brands`, `/brand/{slug}` | Brands index + brand details |
| `/wishlist` | Wishlist (auth) |
| `/cart` | Cart |
| `/checkout` | Multi-step checkout |
| `/order/{id}/success` | Order confirmation |
| `/order/track/{trackingNo}` | Public order tracking |

## 2. Auth

`/login`, `/register`, `/forgot-password`, `/verify-otp`, `/logout`

## 3. Customer Account (`/account/*`)

`/account` dashboard, `/account/orders`, `/account/orders/{id}`,
`/account/returns`, `/account/refunds`, `/account/addresses`, `/account/payment-methods`,
`/account/wishlist`, `/account/reviews`, `/account/notifications`, `/account/coupons`,
`/account/loyalty`, `/account/recently-viewed`, `/account/security`

## 4. Content & Support

`/about`, `/contact`, `/help`, `/faq`, `/privacy-policy`, `/terms`,
`/shipping-policy`, `/return-policy`, `/refund-policy`, `/cancellation-policy`,
`/cookie-policy`, `/blog` (Phase 2)

## 5. Admin (`/admin/*`)

Dashboard: `/admin`, metrics
- Catalog: `/admin/products`, `/admin/products/{id}`, `/admin/categories`, `/admin/brands`,
  `/admin/attributes`, `/admin/variants`, `/admin/collections`, `/admin/import`
- Orders: `/admin/orders`, `/admin/orders/{id}`, status tabs (pending/processing/shipped/
  delivered/cancelled), `/admin/returns`, `/admin/refunds`
- Customers: `/admin/customers`, `/admin/customers/{id}` (profile, orders, segmentation)
- Marketing: `/admin/coupons`, `/admin/campaigns`, `/admin/banners`, `/admin/notifications`
- Inventory: `/admin/inventory`, `/admin/warehouses`, `/admin/stock-movements`, `/admin/low-stock`
- Content: `/admin/homepage`, `/admin/pages`, `/admin/faqs`, `/admin/blog`
- Reports: sales / products / customers / inventory / marketing / payments
- Settings: store, tax, shipping, payments, email, SMS, notifications, security, roles, permissions

Admin is a separate Next.js app sharing the design system, authenticated against the same API
with stronger session policy (MFA in Phase 3).

## 6. API surface (routes live under `/api/v1`) — see `08-API.md`

## 7. Sitemap wiring

`/sitemap.xml` (products, categories, brands, pages), `/robots.txt`, canonical URLs, breadcrumb +
Product + Organization + Review + FAQ structured data (JSON-LD), Open Graph + Twitter cards.
Dynamic SEO metadata per category/product; no duplicate/blank category pages.