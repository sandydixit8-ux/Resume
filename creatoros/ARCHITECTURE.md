# CREATOROS — Product Architecture

**Tagline:** Create. Grow. Sell. Automate. All in One Place.

**Repo:** `creatoros/` — fully separate project (independent of `toolpilotpro`, own package.json, own DB, own deploy).

---

## 1. Product Architecture

CreatorOS is a multi-tenant creator & business monetization operating system. Nine modules share one platform:

| # | Module | Phase | Status note |
|---|--------|-------|-------------|
| 1 | Link-in-Bio Store | Phase 1 (P1) | Landing/Bio page per user with drag-drop blocks |
| 2 | Booking & Calendar | Phase 1 (P1) | Services, availability, slots, confirmations |
| 3 | Course Builder | Phase 3 | Course → Modules → Lessons → Quiz → Certificate |
| 4 | Audience Analytics | Phase 1 (P1) | First-party event analytics + AI insights |
| 5 | Social Automation | Phase 3 | Official-API only integration (IG/YT/etc providers) |
| 6 | Email/Newsletter | Phase 2 | Contacts, lists, segments, campaigns, sequences |
| 7 | Template Library | Phase 2 | 7 categories, search, favorite, duplicate, customize |
| 8 | Creator Community | Phase 3 | Posts, comments, reactions, memberships |
| 9 | AI Strategy Coach | Phase 1 (P1) | Business data → strategy, funnel, content, action plan |

**Build order (per user recommendation):** Bio → Lead Capture → Booking → Analytics → AI first (the full traffic→lead→booking→conversion→analytics loop), then Email, Course, Social AutoDM, Community.

### Core loop
```
Traffic → Landing/Bio page → Lead capture → Booking/Conversion → Analytics → AI Coaching → Repeat
```

---

## 2. User Journey

1. **Sign up** → org + profile auto-created (tenant).
2. **Onboard** → choose username, pick a bio-page template, add socials.
3. **Build bio page** → drag-drop blocks: profile, bio, links, products, booking button, email-capture form, CTA, QR.
4. **Publish** → live at `creator.os/@username`. Copy short link + QR code.
5. **Capture leads** → email opt-in block stores contacts with consent + source attribution.
6. **Automate follow-up (Phase 2)** → welcome sequence via email module.
7. **Book appointments** → visitors pick a service + time slot → confirmation email, reminders, reschedule/cancel.
8. **Sell products/courses (Phase 3)** → Stripe/Razorpay checkout on bio page.
9. **Build community (Phase 3)** → gated members can post/comment/react.
10. **Analyze** → dashboard shows visitors, page views, leads, conversion, bookings, revenue, sources, devices.
11. **AI Coach** → creator submits business snapshot → gets funnel, offers, content plan, weekly action plan.

---

## 3. Feature Map

### Module 1 — Link-in-Bio
- Profile: username, display name, avatar, bio, socials, custom domain (P3)
- Blocks (drag-drop reorder, per-block type, styling): PROFILE, BIO, LINK, PRODUCT, BOOKING, COURSE, SOCIAL, EMAIL_CAPTURE, CTA, QR, CUSTOM_HTML (P3)
- Public page `/@username`: server-rendered, mobile-first, SEO/OG metadata, analytics collection (first-party ping)
- QR code generation (per bio page)
- Email capture block → creates lead (consent-checked)

### Module 2 — Booking
- Services: name, duration, price (optional), description, buffer
- Availability: weekly windows per service (day, start, end, timezone)
- Booking links (`/@username/book/[serviceSlug]`) with public availability calendar
- Booking: name/email/notes → creates booking, confirmation email (SMTP or console-log in dev), reminder (background job, P2)
- Free-busy slot generation with timezone handling (`Intl.DateTimeFormat`, UTC storage)
- Reschedule + cancel (token-based public links + owner dashboard)
- No-double-book: slot locked in transaction

### Module 3 — Course Builder (Phase 3)
Course → Modules → Lessons (video/text) → Quiz → Certificate. AI: course outline, lesson scripts, quiz Qs, sales copy.

### Module 4 — Analytics
- Events: `page_view`, `lead`, `booking`, `booking_created`, `link_click`, `qr_scan` (P2)
- Aggregations: visitors (privacy-safe, click ID hash), page views, leads, conversion (leads/visitors), bookings, revenue (when payments), source (UTM/referrer), device, country (IP → coarse geo, privacy-safe aggregation, no raw IP stored long-term)
- AI insights endpoint: rollups → LLM → plain-language insights + actions

### Module 5 — Social Automation (Phase 3)
Official APIs only. Providers plugged via connector interface (like toolpilotpro social/connectors.ts pattern but isolated here). Content scheduling, lead capture from approved webhook flows, campaign tracking in a UTM-tagged table. **No scraping / no credential harvesting / no unofficial automation.**

### Module 6 — Email (Phase 2)
Contacts (consent fields), lists, segments (filters), campaigns, templates, welcome sequence, nurture. AI campaign copy. SMTP drips.

### Module 7 — Template Library (Phase 2)
Categories: Social Media, Business, Marketing, Creator, PMO, Career, AI. Icons, search, preview, favorite, duplicate, customize. Premium flag gated by plan.

### Module 8 — Community (Phase 3)
Communities, membership (free/paid), posts, comments, reactions, events, member profiles.

### Module 9 — AI Strategy Coach (Phase 1)
Input: business type, audience, offer, traffic volume, revenue, conversion rate, goals.
Output: growth strategy, content strategy, funnel, lead magnet idea, email sequence draft, weekly action plan, conversion recommendations. Every item = measurable action with metric + timeframe.

---

## 4. Database ERD (PostgreSQL-portable SQLite)

All tables keyed by text UUID, `tenant_id` on every tenant row, `created_at`/`updated_at` ISO-8601 UTC.

```
users ──┬── organizations (via memberships, RBAC role)
        ├── profiles (1:1, public creator identity)
        ├── bookings
        ├── contacts (leads)
        └── audit_logs

organizations ──┬── subscriptions
                ├── bio_pages ── bio_blocks
                ├── products
                ├── services ── availability_windows
                ├── analytics_events
                ├── automation_workflows
                ├── notifications
                ├── payments
                └── plans_usage

contacts ── bookings (attendee)
bio_pages ── analytics_events (page_id nullable)
```

Key tables (see `src/lib/db/schema.sql` for DDL):
`users, organizations, memberships, subscriptions, plans_usage, profiles, bio_pages, bio_blocks, products, services, availability_windows, bookings, contacts, email_lists, email_campaigns, templates, communities, posts, analytics_events, automation_workflows, notifications, payments, audit_logs, feature_flags, support_tickets, sessions`.

Multi-tenancy: hard `tenant_id` filter in every query; unique tenant indexes include `tenant_id` prefix; row-level ownership checks in data layer.

---

## 5. API Architecture

REST over Next.js route handlers (`/api/...`), JSON bodies, `zod` validation at every boundary.

**Auth:**
```
POST /api/auth/register      → user+org+profile created, session cookie
POST /api/auth/login         → verify scrypt hash, set session
POST /api/auth/logout
GET  /api/auth/me            → { user, org, profile, plan, limits }
```

**Bio:**
```
GET/POST    /api/bio                      list/create pages
GET/PUT/DELETE /api/bio/[pageId]          read/update/delete page + blocks meta
POST        /api/bio/[pageId]/blocks      add block
PUT         /api/bio/[pageId]/blocks      reorder/update all blocks
GET         /api/bio/[pageId]/qr          QR svg
GET/POST    /api/public/[username]/visit  page render data + track view (first-party)
```

**Lead capture:**
```
POST /api/leads/capture        → creates contact w/ consent + source + page attribution
GET  /api/leads                → contact list (paginated, tenant-scoped)
POST /api/leads/[id]/tag
```

**Booking:**
```
GET/POST /api/booking/services
PUT/DELETE /api/booking/services/[id]
GET/POST /api/booking/services/[id]/availability   (weekly windows)
GET /api/public/[username]/book/[serviceSlug]      availability calendar
POST /api/booking/services/[serviceId]/slots       (computes open slots for a date)
POST /api/booking/[serviceId]/book                 (create booking, lock slot)
POST /api/booking/[bookingId]/reschedule
POST /api/booking/[bookingId]/cancel
GET /api/booking/calendar                          owner dashboard week view
```

**Analytics:**
```
POST /api/track          → first-party event ingestion (page_view, lead, link_click, booking)
GET  /api/analytics/summary  → card rollups (visitors, views, leads, conv, bookings, revenue)
GET  /api/analytics/chart    → time series
GET  /api/analytics/sources /devices /geo  → breakdowns
GET  /api/analytics/insights → AI insights
```

**AI Coach:**
```
POST /api/coach/analyze   → { snapshot } → strategy JSON (structured output, schema-validated)
GET  /api/coach/report    → last report
```

**Billing (Phase 2 full, stubs now):**
```
POST /api/billing/checkout   → Stripe session (env-gated)
POST /api/billing/webhook    → verify signature, update subscription
GET  /api/billing/portal
```

**Response envelope (all APIs):**
```json
{ "ok": true, "data": ... }            | success
{ "ok": false, "error": { "code": "...", "message": "..." } }   | failure
```
Errors: `auth_required, forbidden, not_found, validation, rate_limited, conflict, server_error`.

---

## 6. Folder Structure

```
creatoros/
├── src/
│   ├── app/
│   │   ├── (marketing)/          # public marketing site (landing, pricing, login, register)
│   │   ├── auth/                 # login & register pages
│   │   ├── app/                  # authenticated dashboard
│   │   │   ├── layout.tsx        # sidebar + topnav + session guard
│   │   │   ├── page.tsx          # Dashboard (analytics cards + actions)
│   │   │   ├── bio/              # bio page editor
│   │   │   ├── leads/
│   │   │   ├── booking/          # services + calendar + bookings
│   │   │   ├── analytics/
│   │   │   ├── coach/
│   │   │   ├── billing/
│   │   │   └── settings/
│   │   ├── @[username]/          # public bio page
│   │   │   └── book/[serviceSlug]/  # public booking page
│   │   ├── api/                  # route handlers per module
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/                   # buttons, cards, inputs, charts (lightweight SVG charts, no heavy dep)
│   │   ├── layout/               # sidebar, topnav, dashboard shell
│   │   ├── bio/                  # bio page renderer + editor
│   │   ├── booking/
│   │   ├── analytics/
│   │   ├── coach/
│   │   └── marketing/
│   ├── lib/
│   │   ├── db/
│   │   │   ├── schema.sql        # DDL
│   │   │   ├── db.ts             # sqlite sync engine (node:sqlite) + migrate
│   │   │   └── queries/          # per-module query functions
│   │   ├── auth/
│   │   │   ├── password.ts       # scrypt
│   │   │   ├── session.ts        # HMAC-signed cookie
│   │   │   ├── rbac.ts           # roles + permissions matrix
│   │   │   └── get-session.ts
│   │   ├── security/
│   │   │   ├── rate-limit.ts
│   │   │   ├── xss.ts            # sanitize output
│   │   │   └── validate.ts       # zod helpers
│   │   ├── analytics/engine.ts   # aggregation
│   │   ├── ai/                   # LLM client + structured output
│   │   ├── booking/slots.ts      # availability math
│   │   ├── email/                # SMTP or console fallback
│   │   ├── plans.ts              # plan limits
│   │   ├── billing/              # Stripe stubs
│   │   ├── audit.ts
│   │   └── utils.ts
│   └── types/
├── tests/                        # module-level unit tests
├── scripts/init-db.ts, seed.ts
├── ARCHITECTURE.md
├── ROADMAP.md
├── SECURITY.md
└── package.json
```

---

## 7. MVP Roadmap (per user's recommended order)

### Phase 1 (this build) — "The Core Loop"
1. Auth + multi-tenancy + RBAC + security (rate limit, XSS, validation, audit log)
2. Dashboard shell (sidebar, topnav, analytics cards)
3. Link-in-Bio (editor + public page + QR) → captures traffic
4. Lead capture (email opt-in blocks + contacts) → converts to leads
5. Booking (services + availability + slots + confirmations) → converts to revenue
6. Analytics (tracking + summary + charts + AI insights) → closes the loop
7. AI Strategy Coach v1 → gives growth recommendations
8. Billing scaffolding (plans, usage limits, Stripe-ready stamps)

### Phase 2
Email module, Template library, Payments (Stripe+Razorpay live), Advanced analytics (MRR/ARR/CAC/LTV/churn), Admin panel, support tickets.

### Phase 3
Course builder, Community, Social Automation (official APIs), Automation workflows, Query+segments.

### Phase 4
AI coach advanced (multi-snapshot memory), white-label, custom domains, enterprise SSO, API marketplace.

Each phase: requirements → schema → APIs → UI → validation → tests → security review → perf review → deploy → docs.

---

## 8. Pricing Architecture

| Plan | Price | Per-seat? | Key limits |
|------|-------|-----------|-----------|
| FREE | $0 | no | 1 bio page, 5 links, 10 contacts, 1 service, 1k views/mo |
| STARTER | $9/mo | no | 1 bio page, 25 links, 500 contacts, 3 services, 10k views/mo, 50 AI credits |
| CREATOR | $19/mo | no | 3 bio pages, 100 links, 2k contacts, 10 services, 50k views/mo, 200 AI credits, custom domain |
| PRO | $49/mo | no | 10 bio pages, unlimited links, 10k contacts, unlimited services, 250k views/mo, 800 AI credits, email automation |
| BUSINESS | $99/mo | no | Unlimited everything, team seats, white-label, priority support, API access |

- Usage limits enforced at write-time (see `src/lib/plans.ts`).
- Trials: 14-day CREATOR trial on signup (Phase 2 Stripe).
- Phase 2 billing: Stripe subscriptions + invoices + failed payment retry + dunning + cancellation; Razorpay for IN via a payment provider abstraction.

---

## 9. Security Architecture

- **Auth:** scrypt password hashing (per-user salt), 30-day HMAC-SHA256 signed sessions (HttpOnly, SameSite=Lax, Secure in prod).
- **RBAC:** `owner / admin / editor / viewer` roles; permission matrix enforced server-side in every route (never trust client).
- **Tenant isolation:** every query filtered by `tenant_id` from session; owner checks on org resources; URL-uuid non-enumerable.
- **Encryption:** sensitive payloads (config secrets, webhook keys) AES-256-GCM with key from env; at-rest DB encryption expected at Postgres level in prod.
- **Rate limiting:** in-memory sliding window per IP+route (auth stricter), 429 on exceed.
- **Validation:** zod on every API body; HTML sanitized on output; React escapes by default (XSS).
- **SQL injection:** parameterized statements only (node:sqlite prepared).
- **CSRF:** SameSite cookies + custom header check on mutating APIs.
- **Webhooks:** Stripe signature verification; constant-time compare; replay protection via event id dedup.
- **Audit log:** append-only `audit_logs` (actor, action, resource, tenant, ip, ts).
- **GDPR:** consent flag on contacts; data export (`/api/account/export`); deletion (`/api/account/delete`) cascades tenant data; cookie/consent management on integrating pages.
- **Security headers:** CSP, X-Frame-Options, HSTS, nosniff via `proxy.ts`.

---

## 10. Deployment Architecture

```
[ CDN / Edge  (Vercel/Cloudflare) ]
        │
   Next.js App (serverless/node)
   ├── API routes ──→ Postgres (Neon/Railway/Supabase)
   ├── background jobs (cron: reminders, reports)
   └── AI calls ──→ LLM API (OpenAI-compatible, env-gated)
Storage: S3-compatible (Cloudflare R2 / AWS S3) for avatars, course media, templates.
Cache/Queue: Redis (Upstash) for rate-limit, jobs, hot reads (enabled via env).
Emails: SMTP (Resend/SES/Postmark) or dev console fallback.
Observability: structured logs + Vercel analytics; error tracking hook.
```

Environments: `development` (sqlite file), `preview`, `production` (Postgres via `DATABASE_URL`-like adapter switch in `db.ts`). Secrets only via env vars; no hardcoded secrets; `.env*` gitignored.

---

## Phase 1 Build Status (this repo)

Implemented in this deliverable:

- [x] Architecture, journey, feature map, ERD, API, folder, roadmap, pricing, security, deployment (this doc)
- [x] Database schema + migrate + seed
- [x] Auth + RBAC + tenant helpers
- [x] Dashboard shell + analytics cards + charts
- [x] Bio page editor + public `@username` page + QR
- [x] Lead capture with consent
- [x] Booking services/availability/slots/book
- [x] Analytics tracking + summary + breakdowns + AI insights
- [x] AI Strategy Coach
- [x] Plan limits hook + billing scaffolding
- [x] Vitest unit tests for core logic
- [x] SEO metadata, sitemap, robots, OG