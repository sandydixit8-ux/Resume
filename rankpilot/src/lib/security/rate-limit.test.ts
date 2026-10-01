import { afterEach, describe, expect, it, vi } from "vitest";
import { clearRateLimits, rateLimit, rateLimitStats } from "./rate-limit";

const T0 = new Date("2026-01-01T00:00:00Z").getTime();

describe("rate limiter", () => {
  afterEach(() => {
    vi.useRealTimers();
    clearRateLimits();
  });

  it("allows up to the limit then blocks", () => {
    for (let i = 0; i < 3; i++) {
      expect(rateLimit("k", 3, 60_000).allowed, `call ${i}`).toBe(true);
    }
    const blocked = rateLimit("k", 3, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("reports remaining capacity", () => {
    expect(rateLimit("k", 5, 60_000).remaining).toBe(4);
    expect(rateLimit("k", 5, 60_000).remaining).toBe(3);
  });

  it("keeps keys independent", () => {
    rateLimit("a", 1, 60_000);
    expect(rateLimit("a", 1, 60_000).allowed).toBe(false);
    expect(rateLimit("b", 1, 60_000).allowed).toBe(true);
  });

  it("does not let a short-window call reset a long-window bucket", () => {
    // The regression. The old limiter expired a bucket against whatever window
    // the *current* caller passed, so calling the same key with a short window
    // silently discarded a long window's history and handed the caller a free
    // reset. Time has to actually pass, or nothing has expired and the test
    // passes against the broken code.
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    rateLimit("long", 2, 15 * 60_000);
    rateLimit("long", 2, 15 * 60_000);

    // 2 minutes on: older than a 1-minute window, well inside 15 minutes.
    vi.setSystemTime(T0 + 2 * 60_000);
    rateLimit("long", 2, 60_000);

    expect(rateLimit("long", 2, 15 * 60_000).allowed).toBe(false);
  });

  it("still expires a bucket once its own window has passed", () => {
    // The fix must not turn the limiter into a permanent lockout.
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    rateLimit("k", 2, 60_000);
    rateLimit("k", 2, 60_000);
    expect(rateLimit("k", 2, 60_000).allowed).toBe(false);

    vi.setSystemTime(T0 + 61_000);
    expect(rateLimit("k", 2, 60_000).allowed).toBe(true);
  });

  it("never lets a later call shorten an existing bucket's window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    rateLimit("k", 2, 60 * 60_000);
    rateLimit("k", 2, 60_000);
    // The third call must still see the hour-long window, so it is blocked.
    expect(rateLimit("k", 2, 60_000).allowed).toBe(false);
  });

  it("bounds the keyspace instead of growing without limit", () => {
    // Rotating identifiers is how an attacker grows the map. MAX_KEYS is 10k,
    // so 12k distinct keys must not leave 12k entries resident.
    for (let i = 0; i < 12_000; i++) rateLimit(`rotating-${i}`, 5, 60 * 60_000);
    const stats = rateLimitStats();
    expect(stats.trackedKeys).toBeLessThanOrEqual(stats.maxKeys);
    expect(stats.trackedKeys).toBeGreaterThan(0);
  });

  it("reports rate-limit telemetry for the admin endpoint", () => {
    rateLimit("k", 1, 60_000);
    rateLimit("k", 1, 60_000);
    const stats = rateLimitStats();
    expect(stats.trackedKeys).toBe(1);
    expect(stats.maxKeys).toBeGreaterThan(0);
    expect(typeof stats.totalBlocked).toBe("number");
  });

  it("computes a retry hint inside the window", () => {
    for (let i = 0; i < 2; i++) rateLimit("k", 2, 10_000);
    const res = rateLimit("k", 2, 10_000);
    expect(res.allowed).toBe(false);
    expect(res.retryAfterSec).toBeLessThanOrEqual(10);
    expect(res.retryAfterSec).toBeGreaterThanOrEqual(1);
  });
});
