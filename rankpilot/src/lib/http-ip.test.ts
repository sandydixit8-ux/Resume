import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getClientIp, trustProxy, UNKNOWN_CLIENT_IP } from "./http";

function req(headers: Record<string, string>): Request {
  return new Request("https://app.test/api", { headers });
}

const saved = { ...process.env };

beforeEach(() => {
  delete process.env.TRUSTED_PROXY;
  delete process.env.TRUSTED_PROXY_HOPS;
});

afterEach(() => {
  process.env = { ...saved };
});

describe("getClientIp", () => {
  it("ignores a forged x-forwarded-for when no proxy is trusted", () => {
    const r = req({ "x-forwarded-for": "203.0.113.9" });
    expect(getClientIp(r)).toBe(UNKNOWN_CLIENT_IP);
  });

  it("cannot be given a fresh bucket by rotating the header", () => {
    const buckets = new Set<string>();
    for (let i = 0; i < 25; i++) {
      buckets.add(getClientIp(req({ "x-forwarded-for": `198.51.100.${i}` })));
    }
    expect(buckets.size).toBe(1);
  });

  it("ignores x-real-ip when no proxy is trusted", () => {
    expect(getClientIp(req({ "x-real-ip": "203.0.113.9" }))).toBe(UNKNOWN_CLIENT_IP);
  });

  it("reads the forwarded address when a proxy is trusted", () => {
    process.env.TRUSTED_PROXY = "1";
    expect(getClientIp(req({ "x-forwarded-for": "203.0.113.9" }))).toBe("203.0.113.9");
  });

  it("discards a client-supplied prefix, taking the address from the right", () => {
    process.env.TRUSTED_PROXY = "1";
    const r = req({ "x-forwarded-for": "1.1.1.1, 2.2.2.2, 198.51.100.7" });
    expect(getClientIp(r)).toBe("198.51.100.7");
  });

  it("honours the trusted hop count for multi-proxy deployments", () => {
    process.env.TRUSTED_PROXY = "true";
    process.env.TRUSTED_PROXY_HOPS = "2";
    const r = req({ "x-forwarded-for": "1.1.1.1, 198.51.100.7, 70.41.3.18" });
    expect(getClientIp(r)).toBe("198.51.100.7");
  });

  it("falls back to x-real-ip when x-forwarded-for is absent", () => {
    process.env.TRUSTED_PROXY = "1";
    expect(getClientIp(req({ "x-real-ip": "198.51.100.7" }))).toBe("198.51.100.7");
  });

  it("fails closed when a trusted proxy sends neither header", () => {
    process.env.TRUSTED_PROXY = "1";
    expect(getClientIp(req({}))).toBe(UNKNOWN_CLIENT_IP);
  });

  it("never collides with the real loopback address", () => {
    // The previous fallback returned "127.0.0.1", which is also a legitimate
    // client address, so unknown clients shared a bucket with genuine local ones.
    expect(getClientIp(req({}))).not.toBe("127.0.0.1");
  });

  it("reports proxy trust as opt-in", () => {
    expect(trustProxy()).toBe(false);
    process.env.TRUSTED_PROXY = "1";
    expect(trustProxy()).toBe(true);
  });
});
