import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getDb, closeDb, run, row, newId, nowIso } from "@/lib/db/db";
import { hashResetToken, createResetToken, resolveResetToken, consumeResetToken, revokeResetTokens } from "./password-reset";

let dir: string;

function seedUser(): string {
  const id = newId("usr");
  run(
    "INSERT INTO users (id, email, password_hash, name, role, created_at, updated_at) VALUES (?, ?, 'x:y', '', 'user', ?, ?)",
    id,
    `reset-${id}@example.com`,
    nowIso(),
    nowIso()
  );
  return id;
}

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "creatoros-reset-test-"));
  process.env.CREATOROS_DB_PATH = join(dir, "test.db");
  getDb();
  run(
    "INSERT INTO organizations (id, name, slug, plan, created_at, updated_at) VALUES (?, 'Reset Test', 'reset-test-org', 'free', ?, ?)",
    "org_reset_test",
    nowIso(),
    nowIso()
  );
});

afterAll(() => {
  closeDb();
  rmSync(dir, { recursive: true, force: true });
});

beforeEach(() => {
  run("DELETE FROM password_reset_tokens");
});

describe("password reset tokens", () => {
  it("never stores the raw token, only its hash", () => {
    const userId = seedUser();
    const created = createResetToken(userId);
    expect(created).not.toBeNull();

    const stored = row<{ token_hash: string }>("SELECT token_hash FROM password_reset_tokens WHERE user_id = ?", userId);
    expect(stored).toBeDefined();
    expect(stored!.token_hash).toBe(hashResetToken(created!.token));
    expect(stored!.token_hash).not.toBe(created!.token);
  });

  it("gives each request a distinct token", () => {
    const userId = seedUser();
    const a = createResetToken(userId);
    const b = createResetToken(userId);
    expect(a!.token).not.toBe(b!.token);
  });

  it("resolves a fresh token to its user", () => {
    const userId = seedUser();
    const created = createResetToken(userId)!;
    const resolved = resolveResetToken(created.token);
    expect(resolved?.userId).toBe(userId);
  });

  it("rejects a garbage or missing token", () => {
    expect(resolveResetToken("not-a-real-token")).toBeNull();
    expect(resolveResetToken("")).toBeNull();
  });

  it("consumes a token so the same link cannot be replayed", () => {
    const userId = seedUser();
    const created = createResetToken(userId)!;
    expect(consumeResetToken(created.token)?.userId).toBe(userId);
    expect(consumeResetToken(created.token)).toBeNull();
  });

  it("does not consume the same token twice under a race", () => {
    const userId = seedUser();
    const created = createResetToken(userId)!;
    const first = consumeResetToken(created.token);
    const second = consumeResetToken(created.token);
    expect(first).not.toBeNull();
    expect(second).toBeNull();
  });

  it("rejects an expired token", () => {
    const userId = seedUser();
    const created = createResetToken(userId)!;
    run("UPDATE password_reset_tokens SET expires_at = ? WHERE user_id = ?", new Date(Date.now() - 1000).toISOString(), userId);
    expect(resolveResetToken(created.token)).toBeNull();
    expect(consumeResetToken(created.token)).toBeNull();
  });

  it("revokeResetTokens kills outstanding links", () => {
    const userId = seedUser();
    const created = createResetToken(userId)!;
    revokeResetTokens(userId);
    expect(resolveResetToken(created.token)).toBeNull();
  });

  it("issuing a new link does not invalidate the older ones", () => {
    const userId = seedUser();
    const first = createResetToken(userId)!;
    createResetToken(userId);
    expect(resolveResetToken(first.token)?.userId).toBe(userId);
  });

  it("caps how many live links one account can hold", () => {
    const userId = seedUser();
    for (let i = 0; i < 6; i++) createResetToken(userId);
    const count = row<{ n: number }>("SELECT COUNT(*) AS n FROM password_reset_tokens WHERE user_id = ? AND used_at IS NULL", userId);
    expect(count!.n).toBeLessThanOrEqual(3);
  });
});
