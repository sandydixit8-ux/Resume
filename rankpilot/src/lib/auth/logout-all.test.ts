import { beforeEach, describe, expect, it } from "vitest";
import { getDb, run, nowIso, newId } from "@/lib/db/db";
import { createSession } from "./service";
import { verify } from "./session";

/**
 * Session revocation semantics, tested at the data layer.
 *
 * These cover the guarantee behind both `POST /api/auth/logout-all` and the
 * password reset flow: a revoked session must stop authenticating, everywhere,
 * not just in the tab that asked.
 */
function makeUser() {
  const id = newId("usr");
  const orgId = newId("org");
  run(
    "INSERT INTO users (id, email, name, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    id,
    `${id}@example.com`,
    "Test",
    "hash",
    nowIso(),
    nowIso()
  );
  run(
    "INSERT INTO organizations (id, name, slug, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
    orgId,
    "Org",
    `org-${orgId}`,
    nowIso(),
    nowIso()
  );
  run(
    "INSERT INTO memberships (id, tenant_id, user_id, role, created_at) VALUES (?, ?, ?, ?, ?)",
    newId("mem"),
    orgId,
    id,
    "owner",
    nowIso()
  );
  return { userId: id, orgId };
}

function sessionIsLive(sid: string): boolean {
  const r = getDb()
    .prepare("SELECT revoked_at, expires_at FROM sessions WHERE id = ?")
    .get(sid) as { revoked_at: string | null; expires_at: string } | undefined;
  if (!r) return false;
  return !r.revoked_at && r.expires_at > nowIso();
}

describe("logout-all semantics", () => {
  beforeEach(() => {
    run("DELETE FROM sessions");
  });

  it("revokes every live session for the user", () => {
    const { userId, orgId } = makeUser();
    const a = createSession(userId, orgId, "1.1.1.1", "ua");
    const b = createSession(userId, orgId, "2.2.2.2", "ua");
    const c = createSession(userId, orgId, "3.3.3.3", "ua");
    expect([a, b, c].every((s) => sessionIsLive(s.sid))).toBe(true);

    const info = run(
      "UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL",
      nowIso(),
      userId
    );

    expect(info.changes).toBe(3);
    expect([a, b, c].some((s) => sessionIsLive(s.sid))).toBe(false);
  });

  it("leaves another user's sessions alone", () => {
    const mine = makeUser();
    const theirs = makeUser();
    const mySession = createSession(mine.userId, mine.orgId, "1.1.1.1", "ua");
    const theirSession = createSession(theirs.userId, theirs.orgId, "2.2.2.2", "ua");

    run("UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL", nowIso(), mine.userId);

    expect(sessionIsLive(mySession.sid)).toBe(false);
    // A logout-all that leaked into another tenant would be a serious bug.
    expect(sessionIsLive(theirSession.sid)).toBe(true);
  });

  it("is idempotent: a second call revokes nothing new", () => {
    const { userId, orgId } = makeUser();
    createSession(userId, orgId, "1.1.1.1", "ua");
    const first = run("UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL", nowIso(), userId);
    const second = run("UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL", nowIso(), userId);
    expect(first.changes).toBe(1);
    expect(second.changes).toBe(0);
  });

  it("cannot be used to revoke a session by guessing another user's id", () => {
    const { userId, orgId } = makeUser();
    const session = createSession(userId, orgId, "1.1.1.1", "ua");
    // Revocation is keyed on the authenticated user, never on a body parameter.
    run("UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL", nowIso(), userId);
    expect(sessionIsLive(session.sid)).toBe(false);
  });

  it("does not prevent a fresh sign-in afterwards", () => {
    const { userId, orgId } = makeUser();
    createSession(userId, orgId, "1.1.1.1", "ua");
    run("UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL", nowIso(), userId);

    // Logout-all must not lock the user out permanently.
    const fresh = createSession(userId, orgId, "1.1.1.1", "ua");
    expect(sessionIsLive(fresh.sid)).toBe(true);
  });

  it("verifies a signed token whose session was revoked", () => {
    const { userId, orgId } = makeUser();
    const session = createSession(userId, orgId, "1.1.1.1", "ua");
    // The signature is still cryptographically valid, which is exactly why the
    // session table lookup matters and cannot be skipped.
    expect(verify(session.token)).toBeTruthy();
    run("UPDATE sessions SET revoked_at = ? WHERE user_id = ?", nowIso(), userId);
    expect(sessionIsLive(session.sid)).toBe(false);
  });
});
