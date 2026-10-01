/**
 * The one place that knows the public origin of this deployment.
 *
 * Why this exists: the site URL was previously spelled three different ways in
 * three different files -- `NEXT_PUBLIC_SITE_URL` in layout/robots/sitemap,
 * `APP_URL` in the cron routes, and `RANKPILOT_PUBLIC_URL` in the post-deploy
 * check. Worse, only `APP_URL` was documented in .env.example, so a production
 * deploy that followed the documented setup produced a sitemap, robots.txt and
 * canonical tags all pointing at `http://localhost:3000`. Nothing errors in that
 * state; the site simply tells search engines it lives on localhost and
 * disappears from the index.
 *
 * So: one resolver, one documented variable, and a check that fails loudly when
 * production is still on the default.
 */

import { SITE_URL_ENV, LOCALHOST_SITE_URL } from "./site-url-config";

export type SiteUrlEnv = Record<string, string | undefined>;

/**
 * Candidate variables in precedence order. `SITE_URL` is canonical (see
 * site-url-config for why it is not NEXT_PUBLIC_-prefixed). The older spellings
 * are still accepted so an existing deployment that set one of them keeps
 * working rather than silently reverting to localhost.
 */
const CANDIDATES = ["SITE_URL", "NEXT_PUBLIC_SITE_URL", "APP_URL", "RANKPILOT_PUBLIC_URL"] as const;

/**
 * The configured public origin, with any trailing slash removed and a scheme
 * added if the operator forgot one. Falls back to localhost, which is correct in
 * development and is why `siteUrlProblem` exists to catch it in production.
 */
export function siteUrl(env: SiteUrlEnv = process.env): string {
  for (const name of CANDIDATES) {
    const raw = env[name]?.trim();
    if (!raw) continue;
    const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    try {
      return new URL(withScheme).origin;
    } catch {
      // Unparseable value: keep looking rather than returning something broken.
    }
  }
  return LOCALHOST_SITE_URL;
}

/** Which variable supplied the value, for diagnostics. */
export function siteUrlSource(env: SiteUrlEnv = process.env): string | null {
  for (const name of CANDIDATES) {
    if (env[name]?.trim()) return name;
  }
  return null;
}

/**
 * A human-readable description of why the site URL is unusable, or null if it
 * is fine. Non-fatal by design: it is reported by the admin status endpoint and
 * the post-deploy check, both of which are warnings rather than hard gates,
 * because a local staging box legitimately runs without a public origin.
 */
export function siteUrlProblem(
  env: SiteUrlEnv = process.env,
  { production = env.NODE_ENV === "production" }: { production?: boolean } = {}
): string | null {
  const source = siteUrlSource(env);
  if (!source) {
    return `${SITE_URL_ENV} is not set, so canonical URLs, sitemap.xml and robots.txt will point at ${LOCALHOST_SITE_URL}`;
  }
  const value = siteUrl(env);
  if (production && value === LOCALHOST_SITE_URL) {
    return `${source} resolves to ${LOCALHOST_SITE_URL} in production; search engines will be told the site lives on localhost`;
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return `${source}="${env[source]}" is not a valid URL`;
  }
  if (production && parsed.protocol !== "https:") {
    return `${source} is ${parsed.protocol}// in production; use https:// so canonical URLs are trusted`;
  }
  return null;
}

/**
 * Absolute URL for a site-relative path, used for canonical tags, OG image URLs
 * and JSON-LD `@id` fields. Guarantees exactly one joining slash.
 */
export function absoluteUrl(path: string, env: SiteUrlEnv = process.env): string {
  const base = siteUrl(env);
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Origin for links that carry a security-sensitive token -- password resets and
 * email verification.
 *
 * Returns null when no site URL is configured, and deliberately has no
 * request-derived fallback.
 *
 * This is a security boundary, not a convenience. These routes previously fell
 * back to `new URL(req.url).origin`, which is built from the client-supplied
 * Host header. On a server that accepts an arbitrary Host, an attacker could
 * request a password reset with `Host: evil.com` and the victim would receive a
 * legitimate reset email whose link pointed at the attacker's domain -- handing
 * over the token and the account. Guessing the origin from a request is
 * therefore never correct here, and an unconfigured deployment must fail closed
 * rather than guess.
 */
export function linkBaseUrl(
  env: SiteUrlEnv = process.env
): string | null {
  return siteUrlSource(env) ? siteUrl(env) : null;
}
