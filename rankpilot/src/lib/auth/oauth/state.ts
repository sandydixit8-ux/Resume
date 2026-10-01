import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * OAuth state and PKCE primitives.
 *
 * "Sign in with Google" is a login-CSRF and session-fixation minefield when
 * done lazily: an attacker can pre-build a login for their own account and
 * trick the victim into completing it, or replay an authorization code. PKCE
 * (S256) binds the code to a verifier that only our callback ever sees, and a
 * random `state` value ties the whole flow to the exact browser that started it.
 *
 * Nothing here touches the database. The flow is carried by a single signed,
 * short-lived, HttpOnly cookie (see flow.ts): the `state` value is ALSO sent as
 * the authorization request's `state` parameter, and the callback can only
 * complete if (a) the cookie signature verifies, (b) it has not expired, and
 * (c) the `state` in the URL equals the state in the cookie. An attacker cannot
 * forge the cookie (HMAC) and cannot read the victim's cookie (HttpOnly +
 * SameSite=Lax), so they cannot build a state that matches what the victim's
 * browser will present.
 */

const STATE_TTL_MS = 10 * 60 * 1000;

export function newStateToken(): { state: string; verifier: string } {
  // Independent 32-byte values: one leaking grants nothing about the other.
  return {
    state: randomBytes(32).toString("base64url"),
    verifier: randomBytes(32).toString("base64url"),
  };
}

/**
 * PKCE challenge for the authorization request: S256 of the verifier, as the
 * spec mandates. We never send the plaintext verifier to the authorization
 * server; only the SHA-256 challenge.
 */
export function codeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

/** SHA-256 hex of a token, for constant-time comparisons. */
function digest(raw: string): Buffer {
  return createHash("sha256").update(raw).digest();
}

/**
 * Compare two presented values in constant time. Hashing both sides first means
 * a length mismatch never short-circuits the comparison (timing-safeEqual
 * throws on unequal buffer lengths).
 */
export function tokensEqual(a: string, b: string): boolean {
  const ha = digest(a);
  const hb = digest(b);
  return ha.length === hb.length && timingSafeEqual(ha, hb);
}

export function stateTtlMs(): number {
  return STATE_TTL_MS;
}

export function isFresh(expiresAtMs: number, now = Date.now()): boolean {
  return now < expiresAtMs;
}