import { nowIso, row, run } from "@/lib/db/db";
import { hashToken, newSid, sessionTtlMs, buildSession } from "./session";

export function createSession(
  userId: string,
  orgId: string,
  ip: string,
  ua: string
): { token: string; sid: string } {
  const sid = newSid();
  const token = buildSession({ userId, orgId, sid });
  const expires = new Date(Date.now() + sessionTtlMs()).toISOString();
  run(
    `INSERT INTO sessions (id, tenant_id, user_id, token_hash, expires_at, ip, user_agent, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    sid,
    orgId,
    userId,
    hashToken(token),
    expires,
    ip,
    ua.slice(0, 300),
    nowIso()
  );
  return { token, sid };
}

export function revokeSession(sid: string): void {
  run("UPDATE sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL", nowIso(), sid);
}

export function revokeAllSessions(userId: string): void {
  run("UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL", nowIso(), userId);
}

export function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base || "workspace";
}

export function uniqueSlug(input: string): string {
  const base = slugify(input);
  let candidate = base;
  let i = 1;
  while (row("SELECT id FROM organizations WHERE slug = ?", candidate)) {
    candidate = `${base}-${++i}`;
  }
  return candidate;
}
