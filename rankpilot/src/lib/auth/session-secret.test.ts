import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The secret is read at module load, so this needs a fresh module graph per case.
 */

const saved = { ...process.env };

async function loadSession(env: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  return import("./session");
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  process.env = { ...saved };
  vi.resetModules();
});

describe("AUTH_SECRET handling", () => {
  it("refuses to sign sessions in production without a configured secret", async () => {
    await expect(
      loadSession({ AUTH_SECRET: undefined, NODE_ENV: "production" })
    ).rejects.toThrow(/AUTH_SECRET/);
  });

  it("rejects the published development fallback in production", async () => {
    await expect(
      loadSession({
        AUTH_SECRET: "dev-only-insecure-secret-change-me",
        NODE_ENV: "production",
      })
    ).rejects.toThrow(/AUTH_SECRET/);
  });

  it("rejects the placeholder shipped in .env.example", async () => {
    // 35 characters, so a length check alone would wave this through.
    await expect(
      loadSession({
        AUTH_SECRET: "change-me-to-a-long-random-string",
        NODE_ENV: "production",
      })
    ).rejects.toThrow(/looks like a placeholder/);
  });

  it("rejects a too-short secret in production", async () => {
    await expect(
      loadSession({ AUTH_SECRET: "short-but-configured", NODE_ENV: "production" })
    ).rejects.toThrow(/only 20 characters/);
  });

  it("accepts a real secret in production", async () => {
    const mod = await loadSession({
      AUTH_SECRET: "8f2b41c6d90a37e5b1640dc8fa2e93b7c5d0814fe",
      NODE_ENV: "production",
    });
    expect(mod.COOKIE_NAME).toBe("rankpilot_session");
  });

  it("accepts an explicit secret in production", async () => {
    const mod = await loadSession({ AUTH_SECRET: "a-real-secret", NODE_ENV: "development" });
    expect(mod.COOKIE_NAME).toBe("rankpilot_session");
  });

  it("still allows the fallback outside production so local dev works", async () => {
    const mod = await loadSession({ AUTH_SECRET: undefined, NODE_ENV: "development" });
    expect(mod.COOKIE_NAME).toBe("rankpilot_session");
  });

  it("does not demand a runtime secret during next build", async () => {
    // `next build` runs with NODE_ENV=production but serves nothing, and it
    // imports route modules to collect configuration.
    const mod = await loadSession({
      AUTH_SECRET: undefined,
      NODE_ENV: "production",
      NEXT_PHASE: "phase-production-build",
    });
    expect(mod.COOKIE_NAME).toBe("rankpilot_session");
  });

  it("still refuses at server runtime after a build", async () => {
    await expect(
      loadSession({
        AUTH_SECRET: undefined,
        NODE_ENV: "production",
        NEXT_PHASE: "phase-production-server",
      })
    ).rejects.toThrow(/AUTH_SECRET/);
  });

  it("does not fall back to the published secret during a build", async () => {
    // Two builds must not produce the same signing key.
    const a = await loadSession({
      AUTH_SECRET: undefined,
      NODE_ENV: "production",
      NEXT_PHASE: "phase-production-build",
    });
    const first = a.buildSession({ userId: "u1", orgId: "o1", sid: "s1" });
    const b = await loadSession({
      AUTH_SECRET: undefined,
      NODE_ENV: "production",
      NEXT_PHASE: "phase-production-build",
    });
    const second = b.buildSession({ userId: "u1", orgId: "o1", sid: "s1" });
    expect(first).not.toBe(second);
    expect(b.verify(first)).toBeNull();
  });

  it("signs differently under different secrets", async () => {
    const a = await loadSession({ AUTH_SECRET: "secret-a", NODE_ENV: "development" });
    const tokenA = a.buildSession({ userId: "u1", orgId: "o1", sid: "s1" });
    const b = await loadSession({ AUTH_SECRET: "secret-b", NODE_ENV: "development" });
    const tokenB = b.buildSession({ userId: "u1", orgId: "o1", sid: "s1" });
    expect(tokenA).not.toBe(tokenB);
    expect(b.verify(tokenA)).toBeNull();
  });
});
