import { createHmac, randomBytes, createHash } from "node:crypto";
import { authSecretProblem, isProductionRuntime } from "@/lib/config";

const DEV_FALLBACK_SECRET = "dev-only-insecure-secret-change-me";

/**
 * Fail rather than sign sessions with a secret published in this repo.
 * The `sessions` row (sid + token_hash) is the primary control, so a known
 * secret does not by itself grant access — but the signature is the only thing
 * protecting a payload if any code path ever trusts it without that lookup.
 * The rule itself lives in `lib/config` so the boot check and this cannot drift.
 */
const SECRET = (() => {
  const configured = (process.env.AUTH_SECRET || "").trim();
  // `next build` runs with NODE_ENV=production and imports route modules to
  // collect configuration, but serves nothing. Use an unpredictable per-build
  // value rather than requiring a runtime secret or falling back to a
  // published one: it cannot sign anything meaningful.
  if (process.env.NEXT_PHASE === "phase-production-build") {
    return configured || randomBytes(32).toString("hex");
  }
  if (!isProductionRuntime()) return configured || DEV_FALLBACK_SECRET;
  const problem = authSecretProblem(configured);
  if (problem) {
    throw new Error(`${problem}. Generate a real one with: openssl rand -base64 32`);
  }
  return configured;
})();

// Exported so the OAuth state/cookie signing uses the same secret. Splitting
// them would mean managing two signing keys with no security gain: both protect
// tokens that are validated server-side and are short-lived by design.
export { SECRET };

export const COOKIE_NAME = "rankpilot_session";
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

function hmac(payload: string): Buffer {
  return createHmac("sha256", SECRET).update(payload).digest();
}

export function sign(payload: Record<string, string>): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = hmac(body).toString("base64url");
  return `${body}.${sig}`;
}

export function verify(token: string): Record<string, string> | null {
  const parts = token.split(".");
  // Exactly two segments: a trailing ".extra" must not be quietly ignored.
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  if (!body || !sig) return null;
  const expected = hmac(body);
  const provided = Buffer.from(sig, "base64url");
  if (expected.length !== provided.length) return null;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) mismatch |= expected[i] ^ provided[i];
  if (mismatch !== 0) return null;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

export interface SessionPayload {
  userId: string;
  orgId: string;
  sid: string;
}

export function buildSession(payload: SessionPayload): string {
  return sign({ userId: payload.userId, orgId: payload.orgId, sid: payload.sid });
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function setSessionCookie(token: string): string {
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(
    TTL_MS / 1000
  )}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}

export function getSessionCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader
    .split(";")
    .map((s) => s.trim())
    .find((c) => c.startsWith(`${COOKIE_NAME}=`));
  return match ? match.slice(COOKIE_NAME.length + 1) : null;
}

export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function sessionTtlMs(): number {
  return TTL_MS;
}

export function newSid(): string {
  return randomBytes(16).toString("hex");
}
