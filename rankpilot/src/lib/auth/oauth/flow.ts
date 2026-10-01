import { sign, verify } from "../session";
import {
  codeChallenge,
  isFresh,
  newStateToken,
  stateTtlMs,
  tokensEqual,
} from "./state";

export { stateTtlMs };

/**
 * One OAuth flow, carried in a signed cookie.
 *
 * The cookie holds the PKCE verifier and the `state` value. It is signed (HMAC)
 * so it cannot be forged, HttpOnly so a script cannot read it, SameSite=Lax so
 * it is not sent on cross-site requests, and short-lived so a captured cookie
 * expires in minutes. The callback needs (a) a valid signature, (b) an unexpired
 * cookie, (c) `state` in the query string which is *equal* to `state` in the
 * cookie -- enforced in constant time. Without the cookie there is nothing to
 * complete, so an attacker who starts a flow in the victim's browser cannot
 * finish it themselves, and an attacker who crafts a callback URL cannot guess
 * a state that will match.
 */

export const OAUTH_COOKIE = "rankpilot_oauth";

export interface OAuthFlow {
  state: string;
  verifier: string;
  /** Same-site path to return the browser to after a successful login. */
  redirectTo: string;
  /** The exact callback URL used for both the authorize and token requests. */
  redirectUri: string;
  expiresAt: number;
}

export interface CreatedFlow {
  cookieValue: string;
  /** The `state` query parameter (also inside the cookie). */
  state: string;
  /** The `code_challenge` query parameter, S256 of the verifier. */
  codeChallenge: string;
}

export function createFlow(options: {
  redirectTo: string;
  redirectUri: string;
}): CreatedFlow {
  const { state, verifier } = newStateToken();
  const flow: OAuthFlow = {
    state,
    verifier,
    redirectTo: sanitizeRedirectTo(options.redirectTo),
    redirectUri: options.redirectUri,
    expiresAt: Date.now() + stateTtlMs(),
  };
  return {
    cookieValue: sign(flow as unknown as Record<string, string>),
    state,
    codeChallenge: codeChallenge(verifier),
  };
}

export type FlowResult =
  | { ok: true; flow: OAuthFlow }
  | { ok: false; reason: "not_presented" | "invalid_signature" | "expired" | "state_mismatch" };

/**
 * Validate and unpack a callback's cookie + `state`. Anything that is not
 * exactly our flow fails closed.
 */
export function resolveFlow(cookieValue: string | null, presentedState: string): FlowResult {
  if (!cookieValue || !presentedState) return { ok: false, reason: "not_presented" };
  const payload = verify(cookieValue);
  if (!payload) return { ok: false, reason: "invalid_signature" };
  const expiresAt = Number(payload.expiresAt);
  if (!isFresh(expiresAt)) return { ok: false, reason: "expired" };
  if (!tokensEqual(payload.state ?? "", presentedState)) {
    return { ok: false, reason: "state_mismatch" };
  }
  return {
    ok: true,
    flow: {
      state: payload.state ?? "",
      verifier: payload.verifier ?? "",
      redirectTo: sanitizeRedirectTo(payload.redirectTo ?? "/app"),
      redirectUri: payload.redirectUri ?? "",
      expiresAt,
    },
  };
}

export function oauthCookieSet(cookieValue: string, maxAgeSec: number): string {
  return `${OAUTH_COOKIE}=${cookieValue}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}${
    process.env.NODE_ENV === "production" ? "; Secure" : ""
  }`;
}

export function oauthCookieClear(): string {
  return `${OAUTH_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

/**
 * Only allow same-site paths, so a malicious `?redirect=` cannot send a logged-in
 * user to an external phishing page. Everything else falls back to /app.
 */
export function sanitizeRedirectTo(value: string): string {
  if (!value || typeof value !== "string") return "/app";
  // A path on the same host: starts with "/", but not with a second "/"
  // (that's "//evil.com", which is scheme-relative) and contains no backslash.
  if (value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")) {
    return value.slice(0, 512);
  }
  return "/app";
}