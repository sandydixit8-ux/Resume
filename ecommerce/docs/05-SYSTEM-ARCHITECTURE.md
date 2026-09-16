# System Architecture

## 1. Shape: Modular Monolith → Service Extraction

Start as a **modular monolith**: one deployable API with strongly-bounded modules, one database,
one queue. Clear module boundaries mean we can extract services later without rewrites. We do
**not** build microservices prematurely (ops cost, distributed-debugging cost, no team yet).

```mermaid
flowchart LR
  subgraph Clients
    B[Storefront Next.js]
    A[Admin Next.js]
    M[Mobile app future]
  end
  subgraph Edge
    C[CDN / WAF]
  end
  subgraph API[API - NestJS Modular Monolith]
    CM[Catalog Module]
    OM[Order Module]
    PM[Payment Module]
    IM[Inventory Module]
    SM[Shipping Module]
    SRC[Search Module]
    AM[Auth Module]
    CP[Cart/Checkout Module]
    RCM[Recommender Module]
    NTFY[Notification Module]
    ADM[Admin RBAC / Audit]
  end
  subgraph Data
    DB[(PostgreSQL)]
    R[(Redis cache + queue)]
    OS[(Object Storage R2/S3 + CDN)]
  end
  subgraph External
    PG[Payment Gateway]
    LG[Logistics Provider]
    EM[Email/SMS provider]
    TS[Typesense search (Phase 3)]
  end
  B --> C --> API
  A --> C --> API
  M --> C --> API
  CM --> DB
  OM --> DB
  PM --> DB
  IM --> DB
  PM --> PG
  SM --> LG
  NTFY --> EM
  SRC --> R
  SRC --> TS
  API --- R
  API --- OS
```

## 2. Internal Layering (within each module)

`Controller (validation) → Service (business rules) → Repository/DAO (data)`. Services never
call each other directly across modules; they use an **interface + provider** seam (injectable).
Cross-module cases that matter:

- Checkout calls Inventory `reserve()` (transactional, in same DB).
- Order completion calls Payment `capture` and Notification `send`.
- Price engine computes server-side; client only ever displays.

## 3. Core flows

### Checkout (money-path)
1. Validate cart, prices, stock, coupons, addresses (all server-side, idempotency key).
2. Transactionally reserve inventory; create order (status `PLACED`).
3. Create payment intent via Payment abstraction; redirect/user pays at gateway.
4. Webhook (verified signature) → mark paid (`CONFIRMED`) if capture succeeded.
5. On success: enqueue jobs → email/SMS confirmation, analytics event, update search index.
6. On failure/timeout: order stays payable → user can retry; nightly reconciliation job matches.

### Search (MVP)
PostgreSQL full-text (`tsvector`) + `pg_trgm` for typo tolerance, filtered/sorted in SQL,
aggregates cached in Redis. Phase 3: migrate to Typesense for scale + relevance quality.

## 4. Data & job topology

- **PostgreSQL** is the system of record (orders, payments, inventory, users).
- **Redis**: sessions/cache, rate-limit counters, BullMQ job queue, idempotency keys, flash-sale
  counters.
- **Object storage**: images/videos; CDN delivery; WebP/AVIF variants + thumbnails via async job.
- **Async jobs** (BullMQ): emails, SMS, notifications, image processing, search indexing,
  analytics events, inventory sync, payment reconciliation, shipping updates, recommendation
  recalcs, backup hooks.

## 5. Caching strategy

| Data | Cache | Invalidation |
|---|---|---|
| Categories/config | Redis + ISR | admin publish → purge key/ISR |
| PLP/PDP HTML | ISR/CDN | product/category change → revalidate |
| API responses | Redis TTL | targeted keys |
| Search aggregates | Redis | TTL + index updates |
| Cart/user state | DB (source) + Redis for speed | per-user keys |

Never cache money-sensitive final totals past their validation window; totals recomputed at
checkout regardless.

## 6. Horizontal scaling path

1. MVP: single API instance + managed Postgres/Redis. 
2. Growth: scale API horizontally (stateless), move to read replicas for reporting/search,
   migrate search to Typesense.
3. Scale: extract Order/Payment/Inventory into services around DB + queue, event stream for
   analytics (Kafka/Pulsar), shard/partition heavy tables (orders, inventory_movements, events).
   No schema rewrite required.

## 7. Reliability & failure design

- Third-party calls (PG, LG, email/SMS) are retried with exponential backoff + dead-letter queue.
- Webhooks are idempotent (unique transaction/event key), replayable.
- Checkout exposed to DB lock contention: `SELECT ... FOR UPDATE` on inventory rows inside a
  transaction; overflow-safe counters.
- Graceful degradation: search falls back to Postgres if search service down; recommendations to
  trending fallback; images to original when CDN/thumbnails missing.

## 8. Analytics & observability

Event-driven: storefront/API emit structured events to a queue → analytics pipeline (MVP:
event table + reports; scale: warehouse). Logs structured (pino JSON) → Sentry for errors;
Prometheus metrics → Grafana at scale; uptime checks; RUM for Core Web Vitals.