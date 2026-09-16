# Project Context / Status — E-Commerce Platform

Updated: 2026-09-11

## Current phase
**Phase 3/4 — Commerce + Operations (Pricing v2 — tiered pricing + promotions — done and verified; Typesense search integration done — server-backed once a Typesense host is configured).**
Phase 2 catalog complete and signed off; phase scope chose "Do both": Search v1 (Postgres FTS + pg_trgm) then Cart
(Commerce start), then checkout + orders, then pricing + inventory (real stock enforcement).
- **Typesense search integration done (graceful fallback to Postgres FTS):** new `SearchModule`
  (`apps/api/src/modules/search/search.module.ts`) with `SearchService` — lazy Typesense client
  (v3.0.6 npm client; `TYPESENSE_HOST/PORT/PROTOCOL/ADMIN_API_KEY/SEARCH_API_KEY/COLLECTION` env vars,
  all optional — host empty ⇒ disabled), health-checked with 30s cache, auto-creates the `products`
  collection (fields: id/name/slug/sku/brand/brandId/category/categoryId/price/mrp/status/imageUrl/
  shortDescription/description/salesCount/rating/createdAt, brand+category faceted, name+createdAt
  sortable, default sorting name). `reindex()` bulk-upserts ACTIVE products; `indexProduct(id)`/
  `removeProduct(id)` fire-and-forget hooks on product create/update/delete in `ProductsService`;
  `search(q)` queries query_by `name,brand,sku,shortDescription,description` up to 1000 ids + total.
  Controller: `GET /search/status` (@Public, no secrets — enabled/healthy/host/collection/docCount);
  `POST /search/reindex` (admin, `catalog.edit` → 200 with `{indexed,skipped,status}`). `ProductsService.list`
  now routes through `executeSearch` which uses Typesense when `isHealthy` (with empty-result fallback)
  else Postgres `searchRanked` — filters/facets/sort unchanged (search stays behind the interface per
  docs; ids from engine, rows from DB). Contracts add `search.ts` (`SearchStatusDto`, `ReindexResultDto`).
  **Verified with no Typesense server:** `GET /search/status` → `{enabled:false, message:"Typesense
  disabled"}`; search/typo/filter behavior identical to before (`nexus air`→2, `nexsu`→2, `soundcr`→
  SoundCore Pro Buds, `buds`→SoundCore Pro Buds, `phone`→Nexus Air 5G); reindex as admin → `indexed:0,
  skipped:0, status:disabled`; fresh CUSTOMER → 403. Pricing v2 re-verified (quote ₹62497/@20832.33).
  To enable: set `TYPESENSE_HOST` (+ keys) in `apps/api/.env`, restart API, `POST /search/reindex`.
- **Pricing v2 done:** `PriceTier` model + `Promotion`/`PromotionItem` models + `PriceHistory` extend
  `priceHistoryMetadata` (JSON) with promo + tier fields; migration
  `20260911142043_add_price_tiers_promotions` applied (index on promotion `isActive+startAt+endAt`).
  Contracts: `PriceTierDto/Input`, `PromotionDto/Input/StatusValue`, `PromoMetaDto`, `QuoteRequestItem/
  LineQuoteDto/QuoteDto`, `CartItemDto` gains `basePrice/effectiveUnitPrice/promoDiscount/
  tierMinQuantity/promotionId/Name/Type`, `CartTotalsDto.discount`, `OrderItemDto` gains promo fields.
  `PricingService`: per-variant active tier → base price (highest tier ≤ qty); per-variant active promo
  (PRODUCT/ALL scope, first-wins priority desc, one promo/line, no stacking) — FLAT_OFF capped at
  line total, PERCENTAGE_OFF capped at 100% then line; quote/priceLine both pure, resolver uses
  priceLine. `PricingController`: admin tiers `GET/POST /admin/variants/:id/tiers` (`@price.view/
  @price.tiers`), `DELETE .../tiers/:tierId` (`@price.tiers`); admin promotions `GET /admin/promotions`
  (`@price.view`), `POST`, `PATCH /:id`, `DELETE /:id` (`@price.promotions` — admin guard only, no RBAC
  yet); public `GET /pricing/quote?items[0][variantId]=..&items[0][quantity]=..`.
  **Cart + Checkout integration:** cart live-tier+promo resolution via `PricingService`, `priceTiers`
  on each item, `totals.discount`; checkout re-resolves per item, `subtotal` gross, `discountTotal`,
  `grandTotal = subtotal − discountTotal + shipping`, per-OrderItem promo fields + `priceTiers` include.
  **Seed:** `price` permission group gains `tiers` + `promotions` (via permissions map); demo tiers
  (Nexus Air 5G 2→21999, 3→20999; Cable 5→249); demo promotions (Season Sale — 10% sitewide
  `PERCENTAGE_OFF`, priority 10, active; Air 5G Launch Offer — ₹500 `FLAT_OFF` on `PRODUCT`
  `nexus-air-5g`, priority 20, active). 3 price tiers, 2 promotions seeded. Tier validation: min qty
  integer ≥ 2, price > 0 ≤ mrp; promo validation full (name/type/value/minQty/dates/priority/scope
  product existence). Verified via API: quote (₹62497 + promo → ₹61997; cable ₹1245 → ₹1120.50),
  tier list/upsert/delete + 422 validation, promo CRUD + list/products/variants, product detail promo
  inclusions (PRODUCT + ALL), cart effective prices/promo/tier lines + totals.discount, checkout
  ORDER NX-MTX33PEW-4A6EA4 subtotal/discount/ship=0/grand, RBAC fresh CUSTOMER → tiers/promos 403.
- **Pricing v2 storefront UI done:** variant picker qty-synced unit price from tier lookup, promo
  badges (max all shown), qty pricing table + savings % + "tier applied" notice, add-to-cart selects
  cheapest-promo variant; cart page tier/qty/promo lines per item, `effectiveUnitPrice`, `promoDiscount`
  lines, `totals.discount` shown, subtotal adjusted, "Proceed to Checkout" links; checkout promo
  discount line + adjusted total; order confirmation promo per-item + order `discountTotal` line.
- **Pricing v2 admin UI done:** `/catalog/products` Edit Price card includes quantity tier editor
  (variant select + add/delete tiers with form validation); `/catalog/promotions` page: list promotions
  with status/type/scope/dates/priority, create form (ALL/PRODUCT scope with product checkbox multi-
  select, percentage or flat amount, min quantity, priority, start/end datetime, active toggle), enable/
  disable via PATCH (full payload re-save with flipped `isActive`), delete. `adminFetchEnvelope`
  upgraded to handle 204 empty bodies.
- **Inventory v2 (warehouse transfers + reorder thresholds) done:** schema adds `InventoryTransferStatus`
  enum (IN_TRANSIT/COMPLETED/CANCELLED), `reorderPoint`/`reorderQuantity` on `Inventory`, and
  `InventoryTransfer`/`InventoryTransferItem` models (migration `20260911140338_add_inventory_transfers_reorder`
  applied). API: POST/GET `/admin/inventory/transfers[/:id]` (`@inventory.transfer`) — createTransfer validates
  active + distinct warehouses, per-item source availability (else 422), then atomic tx: decrement source,
  upsert+increment destination, TRANSFER movements on both rows (referenceType TRANSFER + referenceId), items,
  COMPLETED + auto referenceNumber (`TFR-…`); GET `/admin/inventory/reorder-report` (`@inventory.view`) aggregates
  available vs reorderPoint across active warehouses (suggests reorderQuantity); PATCH
  `/admin/inventory/:id/reorder` (`@inventory.adjust`) sets reorderPoint/reorderQuantity. `InventoryRowDto` +
  admin rows carry `reorderPoint`/`reorderQuantity`/`reorderNeeded`. Seed sets reorder 5/20 and
  `lowStockThreshold: 5` on the MUM1 demo rows. Admin `/inventory` gains transfer form (source/dest + per-line
  qty + note, recent transfers), reorder report panel, inline "Reorder" editor per row, and a Reorder badge on
  rows at/below threshold. Verified via API: transfer MUM1→DEL1 (new Delhi warehouse) moved 2×Air + 3×cable with
  correct both-side quantities + remaining availability (12/8 unchanged), over-available 422, same-warehouse 422,
  transfer list + detail with items/note/referenceNumber, reorder report flagged the cable (5≤5, suggested 20),
  reorder PATCH flipped config + report, RBAC fresh CUSTOMER → transfers/reorder/report all 403. Typecheck 9/9,
  API + admin rebuilt/restarted, admin routes 200.
- **Search v1 done:** `products.service` uses `searchRanked` (plainto_tsquery FTS + ts_rank_cd ×2 +
  GREATEST(similarity, word_similarity) ×10 + name/brand prefix boost) with fuzzy fallback
  (`word_similarity(query, name/brand) > 0.45`) for typos; respects facets (brand/category/price)
  and sort; typo queries verified via API (`nexsu`→Nexus Air 5G, `soundcr`→SoundCore Pro Buds).
- **Cart done:** public cart (x-cart-token header) + auth merge. Contracts DTOs
  (`packages/contracts/src/cart.ts`), `CartModule` (cart.service/controller), routes GET/POST/PATCH/
  DELETE `/cart/items`, DELETE `/cart`, POST `/cart/merge`. Verified via API: add (token issuance,
  qty merge), update, remove, clear, unknown-token GET (empty cart), stock soft-check (no warehouse
  rows → unlimited), duplicate-variant merge quantization (3+2=5), anonymous→user merge (anon cart
  emptied). Storefront: CartProvider context (head count), `/cart` page (lines, qty +/-, remove,
  clear, order summary, price-changed/out-of-stock flags), PDP add-to-cart (variant + qty), header
  cart badge with count, anonymous-cart merge on login.
- **Checkout + Orders done:** `OrdersModule` (`checkout.service.ts` placeOrder idempotent via
  client-supplied `idempotencyKey`; `checkout.controller.ts` POST `/checkout/place-order` authed +
  `/checkout/place-order/guest` public + GET `/checkout/sessions/:id` UUID-or-key lookup;
  `orders.service.ts` list/detail/cancel for customer, admin list/detail/status transitions with
  validation map + status history; `orders.me.controller.ts` GET `/users/me/orders[/:id]`, POST
  `/users/me/orders/:id/cancel`; `orders.admin.controller.ts` GET `/admin/orders[/:id]`, PATCH
  `/admin/orders/:id/status` @ `order.view` / `order.update_status`). Server-side price recompute
  from the DB, shipping free ≥ ₹499 else ₹49, discount/tax 0. Payment mock (auto-captured,
  CONFIRMED). Storefront: `/checkout` (cart summary + address + payment method, guest/authed),
  `/order/[orderId]/confirmation` (session lookup), `/account/orders` list + `/account/orders/[id]`
  detail with cancel + status history. Admin: `/orders` list (status filter) + `/orders/[id]`
  detail with allowed-transition buttons. Verified via API: guest + authed checkout, idempotent
  replay (same order), session lookup by UUID and idempotencyKey, cart cleared on order, subtotal/
  shipping math (₹499 free / ₹299+49), COD allowed, ownership (customer C → 404 on B's order), RBAC
  (customer → /admin/orders 403), transitions CONFIRMED→PROCESSING→PACKED→SHIPPED with history,
  illegal transition 422, customer cancel. Storefront/admin routes 200 in prod mode.
- **Inventory v1 done (real stock enforcement):** `PriceHistory` model + migration
  (`20260911132535_add_price_history`); seed gains `price` permission group (roles wired) + demo stock
  (warehouse MUM1 upsert, Nexus Air 5G ×3 variants, Nexus Cable 1m). Contracts
  `inventory.ts`/`pricing.ts` (+ `variantId` on `InventoryAdjustInput`). `InventoryModule`: warehouses
  (admin GET/POST `/admin/warehouses`), stock rows (GET `/admin/inventory` with warehouseId/
  lowStockOnly filters, PATCH `/admin/inventory/adjust` PURCHASE/ADJUSTMENT/DAMAGE/RETURN semantics +
  MANUAL movements), public GET `/inventory/availability?variantIds=` (active warehouses only,
  available = quantity − reserved), `reserveInTransaction` + `releaseOrderReservations`.
  `PricingModule`: PATCH `/admin/products/:id/price` + `/admin/variants/:id/price` (both `@price.update`,
  non-negative + price ≤ mrp validation, writes PriceHistory only on real change). **Enforcement in
  cart/checkout/orders:** cart variant includes now scope `inventories` to active warehouses, add/update
  reject 0-stock (`Out of stock`) and over-available qty (`Only X units available`); checkout pre-checks
  availability, then `reserveInTransaction` per item (reserved ↑); order cancellation
  `releaseOrderReservations` (reserved ↓) inside the status transaction. Verified via API: warehouse
  create, adjust (qty 10/5), availability (10/5, lowStock at ≤ threshold), cart cap 422 + out-of-stock
  422, reserve 10→7 on order then release→10 on cancel, price update writes history
  (`mrp:399→449`, `price:24999→22999`), no-op no dupe, price>mrp 422, admin inventory list.
- **Inventory + Pricing admin UI done:** `/inventory` (warehouse create/list, stock table with on-hand/
  reserved/damaged/available + warehouse + low-stock filters, inline adjust form); products page gains
  "Edit price" (MRP/selling/reason → PATCH + inline price-history list). Storefront PDP fetches
  `/inventory/availability` server-side: out-of-stock variants → disabled "Out of Stock" button, max
  qty caps at available, low-stock banner ("Only X left in stock").
- Monorepo typecheck (9/9) + all package builds green. Next per `docs/12`: enable the Typesense-backed
  search path (server config), then payments.

## Completed
- Phase 0 docs (`docs/00`–`14`) approved; D1–D6 defaults adopted per `docs/14`.
- Monorepo: pnpm (9.15.9) + Turborepo 2, Node 24, TypeScript 5.9. Root scripts, workspace config,
  `turbo.json`, `.gitignore`, `.env.example`.
- `packages/contracts` — shared DTO types + error codes; builds to `dist` (incl. cart DTOs).
- `packages/db` — Prisma v1 schema (~60 models, marketplace-ready) validated + client generated;
  seed script (permissions, 11 roles, first admin). Errors fixed: duplicate `Order.notes`, missing
  relation back-fields site-wide, `@db.Citext` removed. Catalog models: Category (self-ref tree),
  CategoryAttribute, Attribute/AttributeValue, Brand, Product (+ variants/images/attributes), Collection.
  Cart/CheckoutSession/Inventory models pre-exist in `20260911065340_init`.
- `packages/ui` — design tokens CSS, tailwind preset, button/input/card/badge/alert/spinner/skeleton.
- `packages/config` — shared tsconfig/eslint/prettier presets.
- `apps/api` — NestJS modular monolith: config (joi env validation), pino logging, request-id,
  helmet/compression/cookie-parser, global guard chain Throttler→JwtAuth→Rbac, transform interceptor,
  all-exceptions filter, Swagger. Modules live: health, notifications (console provider), auth
  (register/login/OTP/password-reset/refresh rotation with reuse detection/lockout), users, rbac,
  catalog (categories, attributes, brands, products, collections; admin + public controllers),
  cart (public x-cart-token cart + authed merge), orders (checkout place-order guest/authed +
  session lookup, customer orders list/detail/cancel, admin orders list/detail/status transitions).
- `apps/storefront` — Next.js 14: layout/header/footer, homepage, login/register (wired to API),
  catalog PLP (`app/products`, `app/search`) with facets sidebar, price range + sort + category/brand/
  attribute filters, pagination, empty state; PDP (`app/products/[slug]`) with image gallery, SKU
  picker, price/rating/stock UI + live add-to-cart (variant + qty); cart (`app/cart`) with line items,
  qty steppers, remove/clear, order summary, price-changed/out-of-stock flags; checkout
  (`app/checkout` guest + authed, address + payment method + idempotent place order), order
  confirmation (`app/order/[orderId]/confirmation` via session lookup), account orders
  (`app/account/orders` list + detail with cancel + status history); header cart count badge; anonymous
  cart merged on login; `lib/api.ts` envelope client + `cartApi`/`checkoutApi`/`ordersApi`.
- `apps/admin` — Next.js 14: admin shell sidebar, guarded dashboard, login page, `lib/auth`,
  catalog pages: `/catalog/products` (status filter, create form, delete), `/catalog/categories`
  (tree, create, delete), `/catalog` redirect; orders: `/orders` (list + status filter),
  `/orders/[id]` (detail + allowed-transition buttons + history); `lib/api.ts` admin envelope client.

## Verified this session
- `turbo run typecheck` — all 9 packages green.
- `turbo run build` — contracts, db, api (`nest build`), storefront, admin (Next 14) green.
- Migration applied: `packages/db/prisma/migrations/20260911065340_init`. Seed green
  (`Seed complete: permissions, roles, admin user.`).
- **Catalog smoke green (clean truncate → seed → full suite):** admin login; category create
  (nested parent/child); brand + attributes create; product create with variants + images + product
  attributes; publish 200; public `/catalog/tree` (1 root, child counts), `/catalog/brands`,
  `/catalog/attributes`; product list with facets (facets.brands=1) + filters by category/search/
  brand/attribute/price range (total=1 each) + sort (price-asc first item correct); PDP 200
  (variants=2, images=3, attributes=1, related=0); unknown slug 404; collections create/get/list
  (manual products, count=1); RBAC — customer register 201 → OTP verify 200 (code read from console
  provider logs) → login 200 → admin product create **403 OK**; admin list/update 200, delete 204,
  after-delete 404 OK.
- Fixed during catalog work: category create 400 started at `@Min(2)` (numeric rule on a string —
  class-validator coerces) → `@MinLength(2)`; `TransformInterceptor.isPaginated()` dropped sibling
  keys (`facets`) → now returns `{ success, data, meta, ...extra }`; category↔attribute binding added
  via CategoryAttribute composite unique (`bindAttribute`/`unbindAttribute`, admin POST/DELETE
  `/admin/categories/:id/attributes`); attribute codes auto-dedupe with `_N` suffix so smoke filters
  use the returned code, not hardcoded values; smoke harness `GetJson` catch now prints OK when the
  HTTP code matches expectation.
- **Storefront verified in production mode** (`next start -p 3001`, independently queried by
  PowerShell): `/products`, `/products/nexus-air-5g` (SKU listing), `/products?category=mobile-phones`,
  `/products?brand=nexusmobile`, `/search?q=phone`, `/products?sort=price-desc`,
  `/products?priceMin=20000&priceMax=26000` all render correct seeded data.
- **Admin verified**: `next start -p 3002`; `/catalog/products`, `/catalog/categories`, `/login`
  all 200; backends covered by the smoke suite.
- **Search v1 verified via API:** `q=nexus air`→Nexus Air 5G; typo `nexsu`→Nexus Air 5G,
  `soundcr`→SoundCore Pro Buds; `buds`/`earbud`/`phone`/`5g` correct; garbage `@@!!`→0; composites
  `q=soundcore&brand=nexusmobile`→0, `q=buds&category=audio`→1, `q=buds&priceMin=20000`→0,
  `q=buds&category=electronics`→0. Full catalog smoke green after truncate+seed.
- **Cart verified via API:** GET empty cart (token honored); POST item (token issuance); repeated add
  merges qty; PATCH qty; DELETE item; DELETE cart (clear); unknown token → empty cart; qty 100000 with
  no inventory rows → allowed (soft check); merge: anon cart of 3 → user cart, anon emptied; second
  anon merge of same variant adds up (3+2=5). OTP verify + login for CUSTOMER role + merge all green.
- **Storefront cart UI verified in production mode** (`next start -p 3001`): `/cart` 200 (empty
  state), PDP `/products/nexus-air-5g` shows live Add to Cart (variant + qty stepper), header cart
  badge present.
- **Checkout verified via API:** guest colo cart 2×₹24999 → subtotal ₹49999, shipping Free,
  CONFIRMED (UPI CAPTURED), cart cleared; idempotent replay returns same order id; session lookup by
  idempotencyKey works; cheap product (Nexus Cable 1m ₹299) → subtotal ₹299 + ₹49 shipping = ₹348,
  COD works; authed checkout (customer B) pulls email from JWT; cart resolved from x-cart-token.
- **Orders verified via API:** `/users/me/orders` list (`data` = array; interceptor unwraps paginated
  list to `{ success, data: [...], meta }`) + detail (OrderDto direct, not wrapped) + cancel
  (CANCELLED + history entry); ownership 404 (customer C cannot read B's order); admin list filters by
  status, detail includes payment/items/history; transitions CONFIRMED→PROCESSING→PACKED→SHIPPED each
  written to history with reason; illegal jumps (CONFIRMED→DELIVERED, SHIPPED→DELIVERED) → 422;
  customer → `/admin/orders` → 403 RBAC. Summary rows now carry `customerName` + `updatedAt`; items
  carry `variantName` (added to contracts + service, API rebuilt + restarted).
- **Storefront + admin too-prune UI verified in production mode:** `/checkout`, `/account/orders`,
  `/order/[orderId]/confirmation`, admin `/orders`, `/orders/[id]` all 200.
- **Inventory + Pricing verified via API:** warehouse create (MUM1); adjust PURCHASE 10/5; public
  availability 10/5 + lowStock correct; cart add 11 → 422 (cap), update 12 → 422, unstocked variant →
  422 Out of stock; checkout reserve (available 10→7) with CONFIRMED order; admin cancel → released
  (7→10); PATCH product price (mrp 399→449 + history entry), PATCH variant price (24999→22999), no-op
  PATCH → no new history, price>mrp → 422; RBAC: fresh CUSTOMER → admin inventory/price 403.
- **Storefront + admin inventory UI verified in production mode:** `/products/nexus-cable-1m` renders
  "Only 5 left in stock" banner after low-stock adjust (SSR includes hydration-safe text); admin
  `/inventory` + `/catalog/products` 200 (content client-gated behind RequireAuth login). Seed:
  `Seed complete: permissions, roles, admin, demo inventory (4 stock rows, MUM1)`. API rebuilt +
  restarted; storefront/admin rebuilt + restarted on :3001/:3002.
- **Pricing v2 verified via API:** quote endpoint `GET /pricing/quote` returns correct tier resolution
  (air 3× → ₹20999 tier + ₹500 FLAT_OFF promo → line ₹61997 effective ₹20665.67; cable 5× → ₹249
  tier + 10% promo → ₹1120.50 effective ₹224.10); `GET /admin/variants/:id/tiers` returns 3 seeded
  tiers; POST upsert creates/updates tier, DELETE removes; tier validation (min qty <2 → 422, price
  > mrp → 422). `GET /admin/promotions` returns 2 seeded promos (Season Sale + Air 5G Launch Offer);
  POST creates promo, PATCH toggles isActive, DELETE removes; scope PRODUCT/ALL with product arrays
  in response. Product detail `GET /products/nexus-air-5g` shows both promotions on variants; cart
  `GET /cart` shows `effectiveUnitPrice`, `promoDiscount`, `tierMinQuantity` + `totals.discount`;
  checkout order `ORDER NX-MTX33PEW-4A6EA4` subtotal=₹64242 discount=₹624.50 grand=₹63617.50
  with per-item promo fields; RBAC fresh CUSTOMER → `GET /admin/variants/:id/tiers` → 403
  (`Missing permission: price.tiers`), `GET /admin/promotions` → 403 (`Missing permission: price.view`).
- **Typesense search verified (no server configured — fallback path):** `GET /search/status` 200 with
  `enabled:false` + clear message; search behavior unchanged via `ProductsService.executeSearch`
  fallback: `q=nexus air`→2, typo `nexsu`→2, `soundcr`→1 (SoundCore Pro Buds), `buds`→1, `phone`→1
  (Nexus Air 5G); admin `POST /search/reindex` → `{indexed:0, skipped:0, status:{enabled:false}}`; fresh
  CUSTOMER → `POST /search/reindex` → 403 (`catalog.edit`); `turbo run typecheck` 9/9 green; API rebuilt
  + restarted (PID 11312), search controller routes mapped (`/search/status` public);
  pricing v2 quote re-verified ₹62497/@20832.33.
- **Pricing v2 UI verified via production builds:** storefront `/cart` renders promo/tier per line item
  with `effectiveUnitPrice`, `−₹` promo discount, tier notice, adjusted subtotal + discount row +
  "Proceed to Checkout" link; `/checkout` promo discount row + correct total; `/products/[slug]` variant
  picker renders qty-synced unit price from tiers, tier pricing table, promo badges, "tier applied"
  + "promo applied" notice; order confirmation shows promo per item + `discountTotal` row. Admin
  `/catalog/products` Edit Price card includes quantity tier editor (variant select, tier rows with
  delete, add tier form); `/catalog/promotions` renders list (status/type/scope/dates/priority/actions)
  + create form with scope toggle, product multi-select for PRODUCT scope, all fields + Active
  checkbox; seed-promoted promotions show PAUSED/RUNNING status badges correctly. 7/7 apps build
  clean (`turbo run typecheck` + all `build` scripts green); storefront + admin restarted on
  :3001/:3002 with the latest dist.
- Seed/demo data (re-appliable via `epg\truncate.js` + `epg\seed-catalog.ps1`): Electronics/Mobile
  Phones + Audio categories, color/storage attributes, NexusMobile/SoundCore brands, Nexus Air 5G
  (3 SKUs + images), SoundCore Pro Buds, "Summer Picks" collection. Slugs: `nexus-air-5g`,
  `soundcore-pro-buds`, `summer-picks`. Note: SoundCore Pro Buds seed has **no variants** yet — add
  variants before testing its add-to-cart (phone has 3).

## Pending / next recommended action
1. **Enable Typesense in anger:** create a free cluster at cloud.typesense.org, set
   `TYPESENSE_HOST` (+ `TYPESENSE_ADMIN_API_KEY`, `TYPESENSE_SEARCH_API_KEY`) in `apps/api/.env`,
   restart the API, hit `POST /admin`…`/search/reindex` (or the new `POST /search/reindex` with
   `catalog.edit`) and re-run the search smoke suite against the Typesense-backed path. Real
   Razorpay replaces the mock payment step later.
2. Standing up a real Postgres + Redis on the dev machine or a managed host (embedded PG is temp-only;
   the dev `.env` secrets in `apps/api/.env` are gitignored but must be rotated for prod).

## Dev processes (this machine)
- API: listen `:4000`, PID file `C:\Users\Ats\AppData\Local\Temp\opencode\epg\api.pid` (currently
  11312 node, log files `api-out.log`/`api-err.log` beside it).
- Storefront (production preview of the built app): `next start -p 3001`, PID file `sf-pid.txt`
  (currently 11596 node).
- Admin (production preview): `next start -p 3002`, PID file `adm-pid.txt` (currently 17876 node).
- Embedded Postgres: start.js wrapper + postgres server on `:5432` (port/db/user/pass:
  `postgres`/`nexus`/`postgres`/`postgres`), pgdata persists in the same temp dir.
- Ignore other `node.exe` processes on this machine (ResumeIQ `next dev` — unrelated).
- To stop dev processes: `Stop-Process -Id (Get-Content epg\api.pid)`; kill PIDs in `sf-pid.txt`/
  `adm-pid.txt` + the child `node` server PIDs (next start spawns a child; e.g. port check via
  `Get-NetTCPConnection -LocalPort 3001`).

## Decisions so far (assumed — override if disagreed)
- Stack: Next.js + NestJS + PostgreSQL + Redis + R2/CDN, TypeScript monorepo (all installed locally).
- Modular monolith → service extraction; marketplace Phase 7+; India-first, INR.
- Payments Razorpay, logistics Shiprocket, search Postgres→Typesense (all behind interfaces).
- Managed hosting (Render/Railway) for MVP; budget ~$200/mo.

## Known bugs / tech debt
- Description/notes fields on Order vs OrderNote relation clarified (`orderNotes`).
- SoundCore Pro Buds seed product has no variants — add-to-cart for it needs a variant first.
- Cart stock check was soft (no inventory rows → unlimited); **now real** — availability = active-
  warehouse stock − reserved, enforced in cart/checkout/orders with reserve/release. Demo rows seeded
  (MUM1); unseeded variants are out of stock by design.
- Checkout payment is a mock (auto-captured `CAPTURED`); Razorpay integration is deferred to the
  payments milestone.
- cookie write path is `/api/v1/auth` (sameSite lax) — works same-origin/reverse-proxied prod;
  cross-origin dev needs proxy (see `docs/14` local-dev note) OR access-token-only flow for spree cli.
- Refresh token is opaque (random hex, hash stored in DB) — rotation and reuse detection implemented;
  clients must read it from the `nexus_refresh` cookie or (browser-less flows) a future explicit return.
- **Next.js dev-mode quirk:** filtered PLP (`?category=…` etc.) can render empty under `next dev`/dev
  fetch caching even though the API returns the right rows; production mode (`next start`) is correct.
  Verification must use a production build.
- `attrs=` filter matches parent-level ProductAttribute only, not variant-level attributes
  (e.g. `attrs=storage:128gb` returns 0 because storage lives on the variant) — by design for now.
- Embedded PG lives in the OS temp dir — not durable for real dev cycles; stand up persistent Postgres.
- `packages/ui` lacks built `dist` (intentional: consumed as TS source by Next apps).
- `apps/api` tsconfig extends local `../../packages/config/tsconfig.node.json` (package-subpath
  extends does not resolve under node10 resolution) — same for all packages.
- Cart age/max-size/expiry policies and periodic anonymous-cart cleanup are not implemented yet.

## Security issues
Auth hardening in place (bcrypt cost 12, JWT rotation, session reuse detection, lockout, OTP expiry).
Admin catalog endpoints are JwtAuth+Rbac (`catalog.*`) guarded; RBAC verified in smoke. Threat model:
`docs/09-SECURITY.md`. No secrets committed.

## Version
Architecture v1 (approved). DB schema v1.4 (init + price_history + inventory_transfers_reorder + price_tiers_promotions migrations, seeded
with demo inventory + tiers + promotions). API v1 (implemented, smoke verified, incl. search ranking with optional Typesense backend +
cart + checkout/orders + inventory/pricing/tiers/promotions).
Storefront v1 PLP/PDP/cart/checkout/orders/inventory-availability + pricing v2 (tier table/promo badges + cart/checkout promo + qty tiers).
Admin v1 catalog + orders + inventory UI + pricing v2 (tier editor + promotions manager).
Search engine: Typesense-connected SearchModule (runs against a configured Typesense host; falls back to Postgres FTS when absent).