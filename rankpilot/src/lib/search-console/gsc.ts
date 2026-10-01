/**
 * Google Search Console provider client.
 *
 * Server-to-server via a service account: sign a JWT with the account's private
 * key, exchange it for an OAuth access token, then read Search Analytics for
 * the account's verified properties. Implemented against the real endpoints
 * with node:crypto + global fetch — no SDK.
 *
 *   1. JWT  -> POST https://oauth2.googleapis.com/token (grant_type
 *              urn:ietf:params:oauth:grant-type:jwt-bearer, scope
 *              https://www.googleapis.com/auth/webmasters.readonly)
 *   2. Query-> POST https://searchconsole.googleapis.com/webmaster/v3/sites/
 *              {siteUrl}/searchAnalytics/query  (Bearer access_token)
 *
 * Credentials are `GSC_CLIENT_EMAIL` and `GSC_PRIVATE_KEY` (a PEM, `\n` escapes
 * accepted). Missing either, we report the problem instead of guessing. All
 * outbound calls take an injectable fetch for tests.
 */

import { createPrivateKey, sign } from "node:crypto";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const ANALYTICS_URL = "https://searchconsole.googleapis.com/webmaster/v3/sites";
export const GSC_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

export interface GscConfig {
  clientEmail: string;
  privateKey: string;
}

/** Build the active config, or a human reason why Search Console is off. */
export function gscConfig(
  env: Record<string, string | undefined> = process.env
): { config: GscConfig } | { problem: string } {
  const clientEmail = env.GSC_CLIENT_EMAIL?.trim();
  const privateKey = env.GSC_PRIVATE_KEY?.trim();
  if (!clientEmail || !privateKey) {
    return {
      problem:
        "GSC_CLIENT_EMAIL and GSC_PRIVATE_KEY are not set, so Search Console data cannot be pulled",
    };
  }
  return { config: { clientEmail, privateKey } };
}

export interface SearchAnalyticsRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

/** Response contract for the Search Analytics query endpoint. */
interface AnalyticsResponse {
  rows?: SearchAnalyticsRow[];
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

/**
 * Build and sign the service-account JWT assertion. iat/exp only need second
 * granularity; a one-hour lifetime is what Google expects for this grant.
 */
export function buildAssertion(config: GscConfig, now: Date = new Date()): string {
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const iat = Math.floor(now.getTime() / 1000);
  const payload = b64url(
    JSON.stringify({
      iss: config.clientEmail,
      scope: GSC_SCOPE,
      aud: TOKEN_URL,
      exp: iat + 3600,
      iat,
    })
  );
  let key: ReturnType<typeof createPrivateKey>;
  try {
    key = createPrivateKey(config.privateKey.replace(/\\n/g, "\n"));
  } catch {
    throw new Error("GSC_PRIVATE_KEY is not a valid PEM private key");
  }
  const sig = sign("sha256", Buffer.from(`${header}.${payload}`), key);
  return `${header}.${payload}.${b64url(sig)}`;
}

export interface TokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

/** Exchange the JWT assertion for an access token. Throws on transport errors. */
export async function exchangeToken(
  config: GscConfig,
  fetchFn: typeof fetch = fetch,
  now: Date = new Date()
): Promise<string> {
  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: buildAssertion(config, now),
  });
  const res = await fetchFn(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    redirect: "error",
  });
  if (!res.ok) {
    throw new Error(`Google token endpoint returned ${res.status}`);
  }
  const data = (await res.json()) as TokenResponse;
  if (!data.access_token) {
    throw new Error(
      data.error_description ? `token exchange failed: ${data.error_description}` : "token exchange failed"
    );
  }
  return data.access_token;
}

/** Encode a GSC site identifier for the URL path (Google wants it URL-safe). */
function sitePath(siteUrl: string): string {
  return encodeURIComponent(siteUrl);
}

/**
 * Query Search Analytics for one property. `siteUrl` must be a GSC-verified
 * property id (e.g. `sc-domain:example.com` or `https://example.com/`); a
 * property the service account cannot read makes Google answer 403, which we
 * surface as a typed error the caller can render as "no access".
 */
export async function querySearchAnalytics(
  accessToken: string,
  options: {
    siteUrl: string;
    startDate: string;
    endDate: string;
    rowLimit: number;
  },
  fetchFn: typeof fetch = fetch
): Promise<SearchAnalyticsRow[]> {
  const body = {
    startDate: options.startDate,
    endDate: options.endDate,
    dimensions: ["query"],
    rowLimit: options.rowLimit,
  };
  const res = await fetchFn(`${ANALYTICS_URL}/${sitePath(options.siteUrl)}/searchAnalytics/query`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
    redirect: "error",
  });
  if (res.status === 403 || res.status === 404) {
    throw new Error(
      `no_access: the service account cannot read Search Console property ${options.siteUrl}`,
      { cause: { status: res.status } }
    );
  }
  if (!res.ok) {
    throw new Error(`Search Analytics endpoint returned ${res.status}`);
  }
  const data = (await res.json()) as AnalyticsResponse;
  return data.rows ?? [];
}

/** A verified property: its GSC id plus the host it belongs to. */
export interface VerifiedSite {
  siteUrl: string;
  host: string;
}

/**
 * List the properties the service account can read and pick the one matching a
 * website's URL. Prefers an exact URL-prefix property (`https://host/`), then a
 * `sc-domain:` property for the same host. Returns null when nothing matches.
 */
export async function verifiedSiteFor(
  accessToken: string,
  websiteUrl: string,
  fetchFn: typeof fetch = fetch
): Promise<VerifiedSite | null> {
  let host: string;
  try {
    host = new URL(websiteUrl).host;
  } catch {
    return null;
  }
  const res = await fetchFn(`${ANALYTICS_URL}`, {
    method: "GET",
    headers: { authorization: `Bearer ${accessToken}` },
    redirect: "error",
  });
  if (!res.ok) throw new Error(`Search Console site list returned ${res.status}`);
  const data = (await res.json()) as { siteEntry?: { siteUrl: string }[] };
  const entries = (data.siteEntry ?? []).map((e) => e.siteUrl);
  const urlPrefix = entries.find((u) => {
    try {
      return new URL(u).host === host;
    } catch {
      return false;
    }
  });
  if (urlPrefix) return { siteUrl: urlPrefix, host };
  const scDomain = entries.find((u) => u.startsWith(`sc-domain:${host}`));
  if (scDomain) return { siteUrl: scDomain, host };
  return null;
}