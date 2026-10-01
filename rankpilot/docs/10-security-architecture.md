# RankPilot AI — Security Architecture

Threat model highlights: multi-tenant SaaS (data leakage between tenants is the top risk), crawler with outbound fetch (SSRF), AI with user-influenced prompts (injection), auth (session theft/brute force), and website-mutating Auto-Fix (V3, supply-chain risk).

## 1. Authentication

- Email + password, hashed with **scrypt** (N=2^14, r=8, p=1, 16-byte salt, 64-byte key) — no fast hashes. Hashing is **async**: `scryptSync` would burn CPU on the event loop for the whole hash, and login is unauthenticated, so a burst of attempts would stall every other request in the process. The cost parameter is read back from the stored hash and bounded (1024 ≤ N ≤ 2^20) before any hashing, so a tampered row cannot make login brute-forceable or unbounded.
- Session: HMAC-SHA256 signed cookie (`rankpilot_session`, HttpOnly, SameSite=Lax, Secure in prod, 30-day TTL) carrying `{userId, orgId, sid}`. The signature is compared in constant time and a token with extra `.`-separated segments is rejected outright. The signature is *not* the primary control: `getSession()` requires a matching `sessions` row (`id = sid AND token_hash = sha256(token)`) that is neither revoked nor expired, so expiry and revocation are enforced server-side and a leaked cookie stops working at `expires_at` rather than living forever. It also re-reads the membership role and the user's/org's `deleted_at` on every request, so a demotion or deletion takes effect immediately.
- `AUTH_SECRET` is **required in production** and validated at module load: absent, shorter than 32 characters, or matching a placeholder pattern (`change-me`, `example`, …) throws instead of silently signing with the published development fallback. A length check alone is not enough — the placeholder in `.env.example` is 35 characters.
- Login rate limit: 10/15min per IP + 5/15min per email → `429` with uniform error text. Login cannot be used to enumerate accounts: every attempt verifies the password against a decoy hash when the account is unknown, so the response time of a non-existent email matches that of a wrong password. A uniform message alone was not sufficient — skipping the ~100ms scrypt made the timing an enumeration oracle.
- Register: password policy (≥8 chars), duplicate email → `409` with generic message.
- **Session revocation: implemented.** `POST /api/auth/logout-all` revokes every live session for the authenticated user and clears the cookie. A successful password reset revokes all of that user's sessions too, so a stolen cookie does not outlive a password change. The revocation is keyed on the authenticated user id, never on a request body value.
- Password reset and email verification: **implemented** (`/api/auth/forgot-password`, `/api/auth/reset-password`, `/api/auth/verify-email`, `/api/auth/resend-verification`). Tokens are SHA-256 hashed at rest, single-use, expiring, one live token per user, and every failure returns a single opaque reason so a token's history cannot be probed. Forgot-password and resend-verification return an identical generic response and check the email transport before touching the database, so neither reveals whether an account exists. A second factor is not implemented, and the session table has no `amr` column recording how a session was authenticated — so a session cannot currently be distinguished by whether it passed a password check or an OAuth exchange. Recording that is the prerequisite for step-up auth, not something the schema already has.
- **Email delivery is the open gap.** There is no vendor integration, only an `EmailProvider` interface with a generic `webhook` implementation chosen by `EMAIL_PROVIDER`. Until `EMAIL_WEBHOOK_URL` is set, password reset and email verification return 503 with an explicit reason. Users who cannot receive email have no self-service recovery path yet.

## 2. Authorization (RBAC)

Permission matrix in `src/lib/auth/rbac.ts`, roles `owner > admin > editor > analyst > client`. Every mutating endpoint calls `can(role, perm)` — enforced by `src/lib/auth/rbac.test.ts`, which fails the build if a route hardcodes a role comparison or mutates without a permission check. The matrix itself is pinned by tests so it cannot drift.

**Known gap — `client` is *not* scoped to a single website.** A `client` member can currently read every website, issue, and report in its workspace. Per-client website assignment (`agency.website_assign` records the link for reporting) is not yet consulted as an authorization boundary, because the session carries no website scope. Treat `client` as "read-only across the workspace" until that check exists. Note this is distinct from *client workspaces* (Phase 5), which are separate organizations and are fully isolated by `tenant_id`.

## 3. Tenant isolation (top risk)

Rules enforced in the data layer, not the UI:

1. Every query takes the tenant id as a bound parameter from the **session**, never from the request body/query.
2. Tables are one of two kinds, and the difference is deliberate:
   - **tenant-scoped** — carry their own `tenant_id` (the large majority);
   - **parent-scoped** — `copilot_messages` (via `copilot_threads`) and `experiment_variants` (via `experiments`) deliberately have no `tenant_id`. A route must verify the parent belongs to the session's tenant *before* touching the child. Never filter these by a tenant column; join or verify the parent.
3. There is no `scoped.*` wrapper that enforces tenancy for you — scoping is explicit at each call site. Two test suites hold that line: `src/lib/websites/tenancy.test.ts` (repos and every tenant-scoped table) and `src/lib/websites/cross-tenant.test.ts` (real route handlers, signed session for org A aimed at org B's ids).
4. IDs are unguessable prefixed UUIDs, but authorization never relies on ID secrecy: a wrong-tenant ID must return `404`, never data.
5. Write paths that update by bare id (e.g. `UPDATE actions SET … WHERE id = ?`) are preceded by a tenant-scoped ownership `SELECT` and must stay that way. The cross-tenant suite asserts the rejected attempt also writes **no** audit row.
6. Coverage is regression-tested both ways: removing a `tenant_id` predicate from a read or a write makes the suite fail (verified by temporarily breaking `content/[contentId]` GET and `actions/[id]` PATCH).

## 4. Input validation & injection

- zod schemas on every request body; unknown keys are stripped by the default object schema. Query and **path** parameters are not zod-parsed: `websiteId`-style values are opaque ids validated by a tenant-scoped lookup, and `[id]` path params are ids whose ownership is checked before use. They are safe because they are always bound SQL parameters, never interpolated. The only SQL text interpolations are internal clause lists and a column resolved through an allow-list map (enforced by `src/lib/api-validation.test.ts`).
- SQL: parameterized statements only; dynamic identifiers (the website PATCH column, ORDER BY columns) come from an allow-list map.
- CSV export (reports) neutralises **spreadsheet formula injection**. Report cells contain crawled page titles and keyword terms, which a third-party site fully controls, so a page titled `=HYPERLINK("http://evil","Click for report")` would otherwise execute when the victim opens the export. Cells beginning with `= + - @ TAB CR` are prefixed with an apostrophe; genuinely numeric values are left alone so negative scores stay computable. See `src/lib/reports/csv.ts`.
- HTML rendering: every value that originates from a crawled page or an AI response (titles, meta descriptions, heading text, `text_sample`, AI drafts) is rendered as a React child, so it is escaped by React. There is no `dangerouslySetInnerHTML` and no direct `innerHTML` assignment anywhere in `src` (enforced by `src/lib/xss-guard.test.ts`). Note there is **no HTML-preview feature and no sanitizer** — if one is ever added, it must bring its own allow-list sanitizer rather than assuming one already exists.
- Uploads (V2 CSV imports): size caps + type sniffing + row-count limits.

## 5. CSRF & headers

- Cookie is SameSite=Lax + all mutations are `POST/PATCH/DELETE` with `Content-Type: application/json` (not simple forms) → cross-site form CSRF ineffective; JSON POST from another origin is blocked by CORS (no CORS headers issued).
- Security headers via `src/proxy.ts`: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` minimal, no `X-Powered-By`.

## 6. SSRF / crawler safety (see crawler doc)

Any authenticated user can make the server fetch a URL, so this guard is load-bearing. `src/lib/crawler/fetcher.ts` applies, in order:

1. **Protocol** — only `http:`/`https:`; `file:`, `gopher:`, etc. are rejected.
2. **Literal address check** — `isPrivateHost()` on the hostname string. It blocks loopback, RFC1918, CGNAT `100.64/10`, link-local `169.254/16` (cloud metadata), multicast/reserved, IPv6 ULA + link-local, known metadata hostnames, and — importantly — the encodings that defeat naive string matching: a trailing DNS root dot (`localhost.`), shorthand/decimal/hex/octal IPv4 (WHATWG normalises these, so they are checked post-normalisation), and IPv4-mapped IPv6 in hex form (`[::ffff:127.0.0.1]` becomes `::ffff:7f00:1`).
3. **DNS resolution** — every address the hostname resolves to is checked, so a public-looking name with an A record pointing at `127.0.0.1` is rejected. An unresolvable host fails closed with `code: "dns"`.
4. **Redirects** — followed by hand with `redirect: "manual"`, max 5 hops, re-running steps 1–3 on **every** hop. Letting the HTTP client follow redirects would send the request to an internal host before any check ran.

Plus: 15s timeout across all hops, 2 MB body cap, a bot user agent, and `robots.txt` honoured before fetching a path.

**Residual risk (accepted, documented):** a hostile resolver could answer our lookup with a public IP and the subsequent connection with a private one (DNS rebinding). Steps 1–3 raise the cost of that attack but do not eliminate it. Fully closing it needs one of: a pinned-IP HTTP agent, or an egress firewall/proxy rule that denies private ranges at the network layer. **Deployments that can enforce egress rules should** — this is the actual control, and the in-process guard is defence in depth.

## 7. Rate limiting

`src/lib/security/rate-limit.ts` — in-memory sliding window keyed by IP, email, or user. Bounded at 10,000 keys with expiry and oldest-first eviction, so rotating identifiers cannot grow it without limit. Each bucket expires against **its own** window and never against a shorter window passed by a later caller: expiring a 15-minute login bucket against an unrelated short-window call would hand an attacker a free reset. It is per-process, so a multi-node deployment needs a shared store (Redis) before it means anything — each node would otherwise enforce its own independent limit. Responses carry `429`. `rateLimitStats()` exposes key count and blocked total for the owner-only admin endpoint.

| Key | Limit | Where |
|---|---|---|
| `login:ip:<ip>` | 10 / 15 min | `api/auth/login` |
| `login:email:<email>` | 5 / 15 min | `api/auth/login` (stops credential stuffing across IPs) |
| `register:<ip>` | 5 / min | `api/auth/register` |
| `audit:free:<ip>` | 5 / day | `api/audit/free` |
| `crawl:<tenant>` | 10 / hour | `api/websites/:id/crawl` |
| `ai:<tenant>` | 30 / min | `src/lib/ai/server.ts` `aiCall()` — covers all 12 AI tasks centrally |
| `report:<tenant>` | 10 / min | `api/reports` |
| `enrich:<tenant>` | 10 / min | `api/keywords/enrich` |
| `analytics:<tenant>` | 10 / min | `api/analytics/import` |
| `competitor:<tenant>` | 6 / min | `api/competitors` |
| `site:create:<tenant>` | 20 / min | `api/websites` |
| `forgot:ip:<ip>` | 5 / 15 min | `api/auth/forgot-password` |
| `forgot:email:<email>` | 3 / hour | `api/auth/forgot-password` (stops mail-bombing one victim from many IPs) |
| `reset:ip:<ip>` | 10 / 15 min | `api/auth/reset-password` |
| `resend:ip:<ip>` | 5 / hour | `api/auth/resend-verification` |
| `resend:email:<email>` | 3 / hour | `api/auth/resend-verification` |
| `verify:ip:<ip>` | 20 / 15 min | `api/auth/verify-email` |
| `logout-all:<user>` | 10 / 15 min | `api/auth/logout-all` |

AI is limited twice on purpose: the flat 30/min ceiling protects the provider key, while the per-task plan quota in `plans_usage` is the billable limit.

**IP-keyed limits only work if the IP is real.** `getClientIp()` ignores `X-Forwarded-For` and `X-Real-IP` unless `TRUSTED_PROXY=1`, because a directly-exposed server cannot distinguish a real address from a forged header — reading them unconditionally let a caller mint a fresh bucket per request and disable the login, register and free-audit limits outright. The unspoofable `login:email:` limit is the one that still holds regardless of configuration. With the flag unset, every direct client shares a single `untrusted` bucket, so the three IP limits become global caps; see docs/11 for the deployment requirement this implies.

## 8. Secrets & crypto

- `.env` git-ignored; `.env.example` has placeholders only; secrets never reach client bundles (server-only reads, no `NEXT_PUBLIC_`).
- Integration credentials are **not** in the database. `integrations` stores only connection state (`connected|pending|error|disconnected`) and metadata; tokens/secrets are read from server environment variables, so a database export never contains them. Encrypting per-tenant OAuth tokens at rest (AES-256-GCM, `integrations.credentials_enc`) is future work and does not exist yet.
- Audit log coverage is enforced by `src/lib/audit-coverage.test.ts`; the action list lives in `06-api-spec.md`. The 7 routes without an `audit_logs` row each have a stated reason.

## 9. AI-specific controls

- Keys server-side only; user content passed as delimited data; system prompt instructs to ignore instructions embedded in user data.
- Output guardrails block disallowed claims (guaranteed rankings/virality) and strip ungrounded numbers.
- AI cost/quota enforced before execution (`402 quota_exceeded`).

## 10. Auto-Fix safety

The CMS fix flow is `propose → apply → verify → audit`, with a `backup_ref` written **before** any apply attempt. Two invariants hold in this build:

- Without a connected CMS the fix stays `status = 'blocked'` and **nothing on the customer's site is changed** — there is no live-write path.
- Every transition is audited (`cms_fix.propose`, `cms_fix.<action>`).

Rollback of a real applied change is future work; the backup reference is captured so it is possible, but no automated restore exists yet.

## 11. Operational

- Dependency pinning + lockfile; the gate is `npm run typecheck && npm run lint && npm test && npm run build`.
- Backups: SQLite WAL checkpoint + file-level backup. Postgres/PITR is future work.
- PII: only email/name plus the IPs used for security throttling and audit trails; crawl data belongs to the tenant.
- Soft-deleted rows are **not** automatically purged — there is no retention job. `deleted_at` exists on `websites` and `content` so an operator can purge on a schedule, but until that job exists, treat deletion as logical only. `/legal/privacy` says the same thing.
- Error responses never include stack traces or SQL in production.
