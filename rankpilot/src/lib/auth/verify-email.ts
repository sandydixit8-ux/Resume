import { createHash, randomBytes } from "node:crypto";
import { newId, nowIso, row, run, tx } from "@/lib/db/db";
import { VERIFICATION_TTL_MINUTES } from "@/lib/email";

/**
 * Email verification.
 *
 * Same security properties as password reset: the raw token is never stored,
 * a token is single use and expiring, and requesting a new one burns the old.
 * The difference is what consuming it does -- it stamps `email_verified_at`
 * rather than touching a credential.
 */

export type VerifyOutcome =
  | { ok: true; alreadyVerified: boolean; userId: string }
  | { ok: false; reason: "invalid_token" | "expired" | "already_used" };

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function createVerificationToken(userId: string, requestedIp: string | null): string {
  const raw = randomBytes(32).toString("base64url");
  tx(() => {
    run(
      "UPDATE email_verification_tokens SET used_at = ? WHERE user_id = ? AND used_at IS NULL",
      nowIso(),
      userId
    );
    run(
      "INSERT INTO email_verification_tokens (id, user_id, token_hash, expires_at, used_at, requested_ip, created_at) VALUES (?, ?, ?, ?, NULL, ?, ?)",
      newId("evt"),
      userId,
      hashToken(raw),
      new Date(Date.now() + VERIFICATION_TTL_MINUTES * 60_000).toISOString(),
      requestedIp,
      nowIso()
    );
  });
  return raw;
}

export function isEmailVerified(userId: string): boolean {
  return Boolean(row<{ email_verified_at: string | null }>(
    "SELECT email_verified_at FROM users WHERE id = ?",
    userId
  )?.email_verified_at);
}

/**
 * Distinct failure reasons are safe here (unlike reset) because the caller
 * already possesses the token; knowing it expired is not an enumeration
 * vector, and "already used" is genuinely more useful to a real user.
 */
export function consumeVerificationToken(raw: string): VerifyOutcome {
  if (typeof raw !== "string" || raw.length < 20 || raw.length > 200) {
    return { ok: false, reason: "invalid_token" };
  }
  const record = row<{ id: string; user_id: string; expires_at: string; used_at: string | null }>(
    "SELECT id, user_id, expires_at, used_at FROM email_verification_tokens WHERE token_hash = ?",
    hashToken(raw)
  );
  if (!record) return { ok: false, reason: "invalid_token" };
  if (record.used_at) return { ok: false, reason: "already_used" };
  if (record.expires_at <= nowIso()) return { ok: false, reason: "expired" };

  const now = nowIso();
  tx(() => {
    run("UPDATE users SET email_verified_at = ?, updated_at = ? WHERE id = ?", now, now, record.user_id);
    run("UPDATE email_verification_tokens SET used_at = ? WHERE user_id = ? AND used_at IS NULL", now, record.user_id);
  });
  return { ok: true, alreadyVerified: false, userId: record.user_id };
}
