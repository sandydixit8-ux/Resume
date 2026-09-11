# N. Security Architecture

## Tenancy & authorization
- Every business row has `organization_id`. Postgres RLS policies enforce
  `organization_id = any auth.user's orgs` AND branch scoping AND `owner=me OR
  view-all-permission`. RLS is defense-in-depth; server actions also check
  permissions.
- No organization_id is ever trusted from the client; resolved from session.
- Soft delete for business records (retention), hard delete only where legal.

## Authentication & sessions
- Supabase Auth (email/password + OTP links). Passwords hashed server side.
- JWT access + rotating refresh tokens; cookie storage via `@supabase/ssr`.
- `AUTH_SECRET` for cross-service verification. Middleware refreshes tokens and
  redirects; protected routes raise `redirect('/login')`.
- Rate-limited login/OTP to prevent brute force.

## Transport & secrets
- TLS everywhere; HSTS in production deployment.
- Env-only secrets: `DATABASE_URL`, `AUTH_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`,
  `WHATSAPP_API_KEY`, `EMAIL_API_KEY`, `SMS_API_KEY`, `MAPS_API_KEY`,
  `AI_API_KEY`, webhook secrets. Never shipped to the browser; only public
  anon/publishable keys in env available to client build.
- `.env.example` committed; `.env*` gitignored.

## Application hardening
- Validation: zod schemas on every server action + API body.
- SQL injection: parameterized queries via Supabase/Prisma clients only.
- XSS: React escapes by default; sanitize rendered links/hrefs; strict CSP in
  production headers (Next headers config).
- CSRF: cookie-based sessions used only on same-origin; server actions carry
  same-origin checks; state-changing calls require session + same-site cookies.
- File uploads: whitelist mime + extension, size cap, random storage keys,
  serve via signed URLs with TTL.
- Rate limiting: auth, messaging, AI, import endpoints.

## OWASP top-10 coverage summary
- A01 Broken access -> RLS + permission checks (tested)
- A02 Cryptographic failures -> TLS, at-rest encryption on managed DB
- A03 Injection -> parameterized queries
- A04 Insecure design -> threat-modeled flows, bounded AI tools, consent
- A05 Misconfiguration -> production overrides, no debug
- A06 Vulnerable deps -> npm audit in CI
- A07 Auth failures -> rotating refresh, rate limits
- A08 Integrity (AI) -> AI outputs never auto-publish; webhook signatures +
  idempotency
- A09 Logging/monitoring -> audit + observability
- A10 Server-side request forgery -> outbound webhooks whitelisted + verified

## Audit
`audit_logs` (immutable in-app) for every sensitive mutation with
user, timestamp, action, entity, entity_id, old/new json, IP/UA. Normal users
cannot edit/delete; support access is controlled and logged.