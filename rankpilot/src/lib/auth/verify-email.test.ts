import { beforeEach, describe, expect, it } from "vitest";
import { getDb, run, nowIso, newId } from "@/lib/db/db";
import {
  consumeVerificationToken,
  createVerificationToken,
  isEmailVerified,
} from "./verify-email";

function makeUser() {
  const id = newId("usr");
  run(
    "INSERT INTO users (id, email, name, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    id,
    `${id}@example.com`,
    "Test",
    "hash",
    nowIso(),
    nowIso()
  );
  return id;
}

function verifiedAt(userId: string): string | null {
  const r = getDb().prepare("SELECT email_verified_at FROM users WHERE id = ?").get(userId) as
    | { email_verified_at: string | null }
    | undefined;
  return r?.email_verified_at ?? null;
}

describe("email verification tokens", () => {
  beforeEach(() => {
    run("DELETE FROM email_verification_tokens");
  });

  it("marks the address verified on success", () => {
    const userId = makeUser();
    const token = createVerificationToken(userId, "1.2.3.4");
    expect(isEmailVerified(userId)).toBe(false);
    const res = consumeVerificationToken(token);
    expect(res).toEqual({ ok: true, alreadyVerified: false, userId });
    expect(isEmailVerified(userId)).toBe(true);
    expect(verifiedAt(userId)).not.toBeNull();
  });

  it("never stores the raw token", () => {
    const userId = makeUser();
    const raw = createVerificationToken(userId, null);
    const rows = getDb()
      .prepare("SELECT token_hash FROM email_verification_tokens WHERE user_id = ?")
      .all(userId) as unknown as { token_hash: string }[];
    expect(rows[0].token_hash).not.toBe(raw);
  });

  it("is single use", () => {
    const userId = makeUser();
    const token = createVerificationToken(userId, null);
    expect(consumeVerificationToken(token).ok).toBe(true);
    expect(consumeVerificationToken(token)).toEqual({ ok: false, reason: "already_used" });
  });

  it("invalidates the previous token when a new one is issued", () => {
    const userId = makeUser();
    const first = createVerificationToken(userId, null);
    const second = createVerificationToken(userId, null);
    expect(consumeVerificationToken(first)).toEqual({ ok: false, reason: "already_used" });
    expect(consumeVerificationToken(second).ok).toBe(true);
  });

  it("rejects an expired token and does not verify the address", () => {
    const userId = makeUser();
    const token = createVerificationToken(userId, null);
    run(
      "UPDATE email_verification_tokens SET expires_at = ? WHERE user_id = ?",
      new Date(Date.now() - 1000).toISOString(),
      userId
    );
    expect(consumeVerificationToken(token)).toEqual({ ok: false, reason: "expired" });
    expect(isEmailVerified(userId)).toBe(false);
  });

  it("rejects a token that never existed", () => {
    expect(consumeVerificationToken("nonexistent-token-value-xx")).toEqual({
      ok: false,
      reason: "invalid_token",
    });
    expect(consumeVerificationToken("short")).toEqual({ ok: false, reason: "invalid_token" });
  });

  it("keeps the verification timestamp stable on re-verification", () => {
    const userId = makeUser();
    consumeVerificationToken(createVerificationToken(userId, null));
    const first = verifiedAt(userId);
    consumeVerificationToken(createVerificationToken(userId, null));
    expect(verifiedAt(userId)).toBeTruthy();
    expect(typeof first).toBe("string");
  });
});
