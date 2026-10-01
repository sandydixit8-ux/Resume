import crypto from "node:crypto";
import { run, row, nowIso } from "@/lib/db/db";

/**
 * Password reset links.
 *
 * The raw token is emailed to the user and never stored: only its SHA-256
 * hash goes into the database, so a leaked database dump cannot be replayed
 * as a password reset. `used_at` makes each link single-use, and a successful
 * reset drops the account's existing sessions so a stolen cookie dies with it.
 */

const TTL_MINUTES = 60;
const MAX_ACTIVE_PER_USER = 3;

export function hashResetToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** Invalidates any outstanding reset links for a user. */
export function revokeResetTokens(userId: string): void {
  run("UPDATE password_reset_tokens SET used_at = ? WHERE user_id = ? AND used_at IS NULL", nowIso(), userId);
}

/**
 * Creates a token and returns the raw value for emailing. Returns null if the
 * user is unknown so callers can avoid leaking which emails exist.
 */
export function createResetToken(userId: string): { token: string; expiresAt: string } | null {
  // Keep the table small: drop anything already spent or expired, then trim to
  // leave room for the token we are about to insert, so the account never
  // holds more than MAX_ACTIVE_PER_USER live links.
  run("DELETE FROM password_reset_tokens WHERE used_at IS NOT NULL OR expires_at < ?", nowIso());
  run(
    `DELETE FROM password_reset_tokens
      WHERE id IN (
        SELECT id FROM password_reset_tokens
         WHERE user_id = ? AND used_at IS NULL
         ORDER BY created_at DESC
         LIMIT -1 OFFSET ${MAX_ACTIVE_PER_USER - 1}
      )`,
    userId
  );

  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + TTL_MINUTES * 60_000).toISOString();
  run(
    "INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, used_at, created_at) VALUES (?, ?, ?, ?, NULL, ?)",
    `prt_${crypto.randomBytes(12).toString("hex")}`,
    userId,
    hashResetToken(token),
    expiresAt,
    nowIso()
  );
  return { token, expiresAt };
}

export interface ValidReset {
  userId: string;
  email: string;
}

/**
 * Resolves a raw token to its user, provided the link is unexpired, unused
 * and the account still exists. Does not consume it.
 */
export function resolveResetToken(token: string): ValidReset | null {
  if (!token) return null;
  const rec = row<{ id: string; user_id: string; expires_at: string; used_at: string | null }>(
    "SELECT id, user_id, expires_at, used_at FROM password_reset_tokens WHERE token_hash = ?",
    hashResetToken(token)
  );
  if (!rec || rec.used_at) return null;
  if (new Date(rec.expires_at).getTime() <= Date.now()) return null;

  const user = row<{ id: string; email: string }>("SELECT id, email FROM users WHERE id = ?", rec.user_id);
  if (!user) return null;
  return { userId: user.id, email: user.email };
}

/**
 * Consumes a token and hands back its user. Returns null if the token was
 * already spent, so a replayed link cannot reset the password twice.
 */
export function consumeResetToken(token: string): ValidReset | null {
  const valid = resolveResetToken(token);
  if (!valid) return null;
  // Mark used conditionally so two concurrent requests cannot both succeed.
  const result = run(
    "UPDATE password_reset_tokens SET used_at = ? WHERE token_hash = ? AND used_at IS NULL",
    nowIso(),
    hashResetToken(token)
  );
  return result.changes === 1 ? valid : null;
}

export function resetTokenTtlMinutes(): number {
  return TTL_MINUTES;
}
