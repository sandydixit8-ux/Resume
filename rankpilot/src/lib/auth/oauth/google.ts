/**
 * Google identity provider, implemented against the real OIDC/OAuth2 endpoints.
 *
 * Authorization code flow with PKCE (S256):
 *   1. /start  -> GET https://accounts.google.com/o/oauth2/v2/auth?code_challenge=...
 *   2. Google  -> 302 to our callback with ?code=...&state=...
 *   3. callback-> POST https://oauth2.googleapis.com/token (code + verifier)
 *                 -> id_token + access_token
 *   4. callback-> verify the id_token (RS256 signature against Google's JWKS,
 *                 aud == client_id, iss in the documented set, exp not passed)
 *
 * The id_token is verified for real rather than trusted as opaque, because it is
 * the thing that asserts the user's email and subject. This class ships no
 * dependency: node:crypto + global fetch.
 */

import { createPublicKey, verify as verifySig } from "node:crypto";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const ALLOWED_ISS = new Set(["accounts.google.com", "https://accounts.google.com"]);

export interface GoogleProfile {
  provider: "google";
  /** Stable provider-specific subject (never changes for the same Google user). */
  subject: string;
  email: string;
  emailVerified: boolean;
  name: string;
  picture?: string;
}

export interface GoogleProviderConfig {
  clientId: string;
  clientSecret: string;
}

export interface TokenEndpointResponse {
  id_token?: string;
  access_token?: string;
  error?: string;
  error_description?: string;
}

interface JsonWebKey {
  kid?: string;
  kty?: string;
  alg?: string;
  use?: string;
  n?: string;
  e?: string;
}

/**
 * Builds the authorization URL. `redirectUri` MUST be our own callback and must
 * be registered for this client in the Google console; it is never taken from
 * the request.
 */
export function authorizationUrl(config: GoogleProviderConfig, options: {
  state: string;
  codeChallenge: string;
  redirectUri: string;
}): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: "code",
    scope: "openid email profile",
    redirect_uri: options.redirectUri,
    state: options.state,
    code_challenge: options.codeChallenge,
    code_challenge_method: "S256",
    // Always offer to pick an account, otherwise a user stuck on an unexpected
    // Google account has no way out until they sign out of that account.
    prompt: "select_account",
  });
  return `${AUTH_URL}?${params.toString()}`;
}

async function postToken(config: GoogleProviderConfig, options: {
  code: string;
  verifier: string;
  redirectUri: string;
  fetchFn?: typeof fetch;
}): Promise<TokenEndpointResponse> {
  const f = options.fetchFn ?? fetch;
  const body = new URLSearchParams({
    code: options.code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: options.redirectUri,
    grant_type: "authorization_code",
    code_verifier: options.verifier,
  });
  const res = await f(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    redirect: "error",
  });
  if (!res.ok) {
    throw new Error(`Google token endpoint returned ${res.status}`);
  }
  return (await res.json()) as TokenEndpointResponse;
}

/**
 * Verify an id_token. Returns the parsed claims, or null when anything about
 * the signature, issuer, audience or expiry is wrong. Never throws on a bad
 * token; always fails closed.
 */
export async function verifyIdToken(
  idToken: string,
  clientId: string,
  fetchFn: typeof fetch = fetch,
): Promise<Record<string, unknown> | null> {
  const parts = idToken.split(".");
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, sigB64] = parts;

  let header: { alg?: string; kid?: string };
  let claims: Record<string, unknown>;
  try {
    header = JSON.parse(Buffer.from(headerB64, "base64url").toString("utf8"));
    claims = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  // Google signs id_tokens with RS256; never fall back to accepting another alg.
  if (header.alg !== "RS256" || !header.kid) return null;

  const jwks = await fetchJwks(fetchFn);
  const key = jwks.find(
    (k) => k.kid === header.kid && k.kty === "RSA" && (k.use === undefined || k.use === "sig")
  );
  if (!key?.n || !key.e) return null;

  let publicKey: ReturnType<typeof createPublicKey>;
  try {
    publicKey = createPublicKey({
      key: { kty: "RSA", n: key.n, e: key.e },
      format: "jwk",
    });
  } catch {
    return null;
  }

  const signed = `${headerB64}.${payloadB64}`;
  const sig = Buffer.from(sigB64, "base64url");
  let ok = false;
  try {
    ok = verifySig("sha256", Buffer.from(signed, "utf8"), publicKey, sig);
  } catch {
    return null;
  }
  if (!ok) return null;

  // Claims level checks. These are the values the rest of the app trusts.
  const iss = claims.iss;
  if (typeof iss !== "string" || !ALLOWED_ISS.has(iss)) return null;
  const aud = claims.aud;
  if (typeof aud !== "string" || aud !== clientId) return null;
  const exp = claims.exp;
  if (typeof exp !== "number" || exp * 1000 <= Date.now()) return null;
  const sub = claims.sub;
  if (typeof sub !== "string" || !sub) return null;
  return claims;
}

let jwksCache: { keys: JsonWebKey[]; fetchedAt: number } | null = null;

/** Google's certs rotate, so cache for a short window then re-fetch. */
async function fetchJwks(fetchFn: typeof fetch): Promise<JsonWebKey[]> {
  const TTL = 5 * 60 * 1000;
  if (jwksCache && Date.now() - jwksCache.fetchedAt < TTL) return jwksCache.keys;
  const res = await fetchFn(JWKS_URL, { redirect: "error" });
  if (!res.ok) throw new Error(`Google JWKS endpoint returned ${res.status}`);
  const body = (await res.json()) as { keys?: JsonWebKey[] };
  if (!Array.isArray(body.keys)) throw new Error("Google JWKS response had no keys");
  jwksCache = { keys: body.keys, fetchedAt: Date.now() };
  return body.keys;
}

export { AUTH_URL, TOKEN_URL, JWKS_URL };

/**
 * Turn an exchanged id_token into the profile the app stores. Requires the email
 * to be Google-verified: an unverified claim is the one case where we cannot
 * safely link to an account by email.
 */
export async function profileFromIdToken(
  idToken: string,
  clientId: string,
  fetchFn: typeof fetch = fetch,
): Promise<GoogleProfile | null> {
  const claims = await verifyIdToken(idToken, clientId, fetchFn);
  if (!claims) return null;
  const email = claims.email;
  const emailVerified = claims.email_verified === true;
  const sub = claims.sub;
  const name = claims.name;
  if (typeof sub !== "string" || !sub) return null;
  if (typeof email !== "string" || !email) return null;
  if (!emailVerified) return null;
  return {
    provider: "google",
    subject: sub,
    email: email.toLowerCase(),
    emailVerified: true,
    name: typeof name === "string" && name ? name : email.split("@")[0],
    picture: typeof claims.picture === "string" ? claims.picture : undefined,
  };
}

/**
 * Full code exchange: POST token, then verify and unpack the id_token.
 * Returns null when the provider gave us something unusable; throws on transport
 * errors so the route can distinguish "provider unavailable" from "bad code".
 */
export async function exchangeGoogleCode(
  config: GoogleProviderConfig,
  options: { code: string; verifier: string; redirectUri: string; fetchFn?: typeof fetch },
): Promise<GoogleProfile | null> {
  const f = options.fetchFn ?? fetch;
  const token = await postToken(config, options);
  if (token.error || !token.id_token) {
    if (token.error && token.error !== "invalid_grant") {
      // A non-invalid_grant error from Google means configuration or policy,
      // not a reused code -- surface it rather than pretending login failed.
      throw new Error(`Google token exchange error: ${token.error}`);
    }
    return null;
  }
  return profileFromIdToken(token.id_token, config.clientId, f);
}

/** @internal exposed for tests to clear the memoized JWKS. */
export function clearJwksCache(): void {
  jwksCache = null;
}