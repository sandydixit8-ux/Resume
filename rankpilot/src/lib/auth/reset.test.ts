import { beforeEach, describe, expect, it } from "vitest";
import { getDb, run, nowIso, newId } from "@/lib/db/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { consumeResetToken, createResetToken, activeResetTokenCount } from "./reset";

function makeUser(password = "original-password-1") {
  const id = newId("usr");
  run(
    "INSERT INTO users (id, email, name, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    id,
    `${id}@example.com`,
    "Test",
    "",
    nowIso(),
    nowIso()
  );
  run("UPDATE users SET password_hash = ? WHERE id = ?", password, id);
  return id;
}

async function realHash(userId: string) {
  const row = getDb()
    .prepare("SELECT password_hash FROM users WHERE id = ?")
    .get(userId) as { password_hash: string } | undefined;
  return row?.password_hash ?? "";
}

function makeSession(userId: string) {
  const id = newId("ses");
  // sessions.tenant_id is a real foreign key, so the org has to exist.
  const orgId = newId("org");
  run(
    "INSERT INTO organizations (id, name, slug, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
    orgId,
    "Test Org",
    `test-${orgId}`,
    nowIso(),
    nowIso()
  );
  run(
    "INSERT INTO sessions (id, tenant_id, user_id, token_hash, expires_at, revoked_at, ip, user_agent, created_at) VALUES (?, ?, ?, ?, ?, NULL, NULL, NULL, ?)",
    id,
    orgId,
    userId,
    `hash-${id}`,
    new Date(Date.now() + 86_400_000).toISOString(),
    nowIso()
  );
  return id;
}

function sessionRevoked(id: string): boolean {
  const row = getDb().prepare("SELECT revoked_at FROM sessions WHERE id = ?").get(id) as
    | { revoked_at: string | null }
    | undefined;
  return Boolean(row?.revoked_at);
}

describe("password reset tokens", () => {
  beforeEach(() => {
    run("DELETE FROM password_reset_tokens");
    run("DELETE FROM sessions");
  });

  it("never stores the raw token", () => {
    const userId = makeUser();
    const raw = createResetToken(userId, "1.2.3.4");
    const rows = getDb()
      .prepare("SELECT token_hash FROM password_reset_tokens WHERE user_id = ?")
      .all(userId) as unknown as { token_hash: string }[];
    expect(rows[0].token_hash).not.toBe(raw);
    expect(raw).not.toContain(rows[0].token_hash);
  });

  it("issues a token that actually resets the password", async () => {
    const userId = makeUser();
    const raw = createResetToken(userId, null);
    const res = await consumeResetToken(raw, "a-brand-new-password-9");
    expect(res.ok).toBe(true);
    const stored = await realHash(userId);
    expect(await verifyPassword("a-brand-new-password-9", stored)).toBe(true);
    expect(await verifyPassword("original-password-1", stored)).toBe(false);
  });

  it("burns the token so the same link cannot be replayed", async () => {
    const userId = makeUser();
    const raw = createResetToken(userId, null);
    expect((await consumeResetToken(raw, "first-new-password-1")).ok).toBe(true);
    const second = await consumeResetToken(raw, "second-new-password-2");
    expect(second).toEqual({ ok: false, reason: "invalid_token" });
    // And the password must not have changed on the replay attempt.
    const stored = await realHash(userId);
    expect(await verifyPassword("first-new-password-1", stored)).toBe(true);
  });

  it("revokes every session for the user, which is the point of a reset", async () => {
    const userId = makeUser();
    const stolen = makeSession(userId);
    const alsoStolen = makeSession(userId);
    expect(sessionRevoked(stolen)).toBe(false);
    await consumeResetToken(createResetToken(userId, null), "new-password-12345");
    expect(sessionRevoked(stolen)).toBe(true);
    expect(sessionRevoked(alsoStolen)).toBe(true);
  });

  it("invalidates the previous token when a new one is issued", async () => {
    const userId = makeUser();
    const first = createResetToken(userId, null);
    const second = createResetToken(userId, null);
    expect((await consumeResetToken(first, "nope-not-this-one-1")).ok).toBe(false);
    expect((await consumeResetToken(second, "yes-this-one-works-1")).ok).toBe(true);
  });

  it("keeps at most one live token per user", () => {
    const userId = makeUser();
    createResetToken(userId, null);
    createResetToken(userId, null);
    createResetToken(userId, null);
    expect(activeResetTokenCount(userId)).toBe(1);
  });

  it("rejects an expired token", async () => {
    const userId = makeUser();
    const raw = createResetToken(userId, null);
    run("UPDATE password_reset_tokens SET expires_at = ? WHERE user_id = ?", new Date(Date.now() - 1000).toISOString(), userId);
    expect((await consumeResetToken(raw, "any-password-here-1")).ok).toBe(false);
  });

  it("returns the same opaque failure for every bad token", async () => {
    const userId = makeUser();
    const raw = createResetToken(userId, null);
    await consumeResetToken(raw, "first-password-set-1");
    const reused = await consumeResetToken(raw, "second-password-set-2");
    const neverExisted = await consumeResetToken("not-a-real-token-at-all-xx", "third-password-3");
    const malformed = await consumeResetToken("short", "fourth-password-4");
    // If these differ, a caller can probe which tokens once existed.
    expect(reused).toEqual({ ok: false, reason: "invalid_token" });
    expect(neverExisted).toEqual({ ok: false, reason: "invalid_token" });
    expect(malformed).toEqual({ ok: false, reason: "invalid_token" });
  });

  it("enforces the registration password length", async () => {
    const userId = makeUser();
    const raw = createResetToken(userId, null);
    expect(await consumeResetToken(raw, "short")).toEqual({ ok: false, reason: "weak_password" });
    // A rejected password must leave the token usable, or a typo locks the
    // user out until they request another email.
    expect((await consumeResetToken(raw, "long-enough-password-1")).ok).toBe(true);
  });

  it("refuses to reset a deleted account", async () => {
    const userId = makeUser();
    const raw = createResetToken(userId, null);
    run("UPDATE users SET deleted_at = ? WHERE id = ?", nowIso(), userId);
    expect(await consumeResetToken(raw, "whatever-password-1")).toEqual({ ok: false, reason: "no_user" });
  });

  it("generates unguessable tokens", () => {
    const userId = makeUser();
    const seen = new Set<string>();
    for (let i = 0; i < 25; i++) {
      const t = createResetToken(userId, null);
      expect(t.length).toBeGreaterThanOrEqual(40);
      seen.add(t);
    }
    expect(seen.size).toBe(25);
  });

  it("hashes the new password rather than storing it", async () => {
    const userId = makeUser(await hashPassword("start-password-1234"));
    const raw = createResetToken(userId, null);
    await consumeResetToken(raw, "brand-new-secret-999");
    const stored = await realHash(userId);
    expect(stored).not.toBe("brand-new-secret-999");
    expect(stored).not.toContain("brand-new-secret-999");
  });
});
