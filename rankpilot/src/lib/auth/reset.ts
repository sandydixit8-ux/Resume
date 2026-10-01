import { createHash, randomBytes } from "node:crypto";
import { hashPassword } from "./password";
import { newId, nowIso, row, run, tx } from "@/lib/db/db";
import { RESET_TTL_MINUTES } from "@/lib/email";
/**
 * Password reset.
 *
 * Invariants worth stating, because each one is a way this normally goes wrong:
 *  - Only the hash of the token is stored. A leaked database must not yield
 *    working reset links.
 *  - One token per user: requesting a new one invalidates the old, so a link
 *    forwarded to an attacker stops working as soon as the real user is
 *    suspicious.
 *  - Consuming a token revokes every session for that user. Without this, a
 *    stolen session would outlive the password change and the reset would be
 *    security theatre.
 *  - Every failure mode returns the same opaque result, so a caller cannot
 *    distinguish "no such token" from "expired" from "already used".
 */

const TTL_MIN = RESET_TTL_MINUTES;

export type ResetOutcome = "ok" | "invalid_token" | "weak_password" | "no_user";

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** Issues a token and returns the raw value, which is never recoverable later. */
export function createResetToken(userId: string, requestedIp: string | null): string {
  const raw = randomBytes(32).toString("base64url");
  tx(() => {
    run(
      "UPDATE password_reset_tokens SET used_at = ? WHERE user_id = ? AND used_at IS NULL",
      nowIso(),
      userId
    );
    run(
      "INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, used_at, requested_ip, created_at) VALUES (?, ?, ?, ?, NULL, ?, ?)",
      newId("prt"),
      userId,
      hashToken(raw),
      new Date(Date.now() + TTL_MIN * 60_000).toISOString(),
      requestedIp,
      nowIso()
    );
  });
  return raw;
}

export function activeResetTokenCount(userId: string): number {
  return (
    row<{ n: number }>(
      "SELECT COUNT(*) AS n FROM password_reset_tokens WHERE user_id = ? AND used_at IS NULL AND expires_at > ?",
      userId,
      nowIso()
    )?.n ?? 0
  );
}

/**
 * Consumes a token and sets the new password, revoking all sessions.
 *
 * `newPassword` is hashed before the transaction opens: scrypt is deliberately
 * slow, and holding a write lock for ~100ms would serialise every other writer
 * in the database.
 */
export async function consumeResetToken(
  raw: string,
  newPassword: string
): Promise<{ ok: true } | { ok: false; reason: "invalid_token" | "weak_password" | "no_user" }> {
  if (typeof raw !== "string" || raw.length < 20 || raw.length > 200) {
    return { ok: false, reason: "invalid_token" };
  }
  // Match the registration rule so a reset cannot set a password that signup
  // would have rejected.
  if (newPassword.length < 8 || newPassword.length > 200) {
    return { ok: false, reason: "weak_password" };
  }

  const record = row<{ id: string; user_id: string; expires_at: string; used_at: string | null }>(
    "SELECT id, user_id, expires_at, used_at FROM password_reset_tokens WHERE token_hash = ?",
    hashToken(raw)
  );
  const now = nowIso();
  if (!record || record.used_at || record.expires_at <= now) {
    return { ok: false, reason: "invalid_token" };
  }

  const user = row<{ id: string; deleted_at: string | null }>(
    "SELECT id, deleted_at FROM users WHERE id = ?",
    record.user_id
  );
  if (!user || user.deleted_at) return { ok: false, reason: "no_user" };

  const passwordHash = await hashPassword(newPassword);
  tx(() => {
    run("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?", passwordHash, now, user.id);
    run("UPDATE password_reset_tokens SET used_at = ? WHERE id = ?", now, record.id);
    // Also burn any sibling tokens, so an older link cannot be replayed.
    run(
      "UPDATE password_reset_tokens SET used_at = ? WHERE user_id = ? AND used_at IS NULL",
      now,
      user.id
    );
    // The point of the reset: a stolen session must not survive it.
    run(
      "UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL",
      now,
      user.id
    );
  });
  return { ok: true };
}
