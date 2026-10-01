import { describe, expect, it } from "vitest";
import { scrypt } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { hashPassword, verifyPassword, parseScryptHash } from "@/lib/auth/password";
import { buildSession, sign, verify } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";

describe("password hashing", () => {
  it("verifies the right password and rejects the wrong one", async () => {
    const h = await hashPassword("correct horse battery");
    expect(h.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("correct horse battery", h)).toBe(true);
    expect(await verifyPassword("wrong", h)).toBe(false);
  });

  it("salts per hash", async () => {
    expect(await hashPassword("same")).not.toBe(await hashPassword("same"));
  });

  it("rejects malformed stored hashes", async () => {
    expect(await verifyPassword("x", "garbage")).toBe(false);
  });

  it("does not hash synchronously on the login path", () => {
    // A timing assertion cannot prove this: with a sync implementation both
    // timers still fire in registration order, so the event loop looks fine.
    // Assert the invariant directly instead — `scryptSync` burns CPU on the
    // event loop for the whole hash, and login is unauthenticated, so a burst
    // of attempts would stall every other request in the process.
    const src = readFileSync(join(process.cwd(), "src", "lib", "auth", "password.ts"), "utf8");
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(code, "password hashing must not use scryptSync").not.toMatch(/scryptSync/);
  });

  it("rejects a stored cost parameter that is outside the accepted range", async () => {
    // Guards against a tampered row turning login into an unbounded or
    // brute-forceable computation.
    const h = await hashPassword("pw");
    const [, , salt, digest] = h.split("$");
    expect(parseScryptHash(`scrypt$${1 << 24}$${salt}$${digest}`)).toBeNull();
    expect(parseScryptHash(`scrypt$${16}$${salt}$${digest}`)).toBeNull();
    expect(parseScryptHash(`scrypt$${1 << 24}$${salt}$${digest}`)).toBeNull();
    expect(parseScryptHash(`scrypt$notanumber$${salt}$${digest}`)).toBeNull();
    expect(await verifyPassword("pw", `scrypt$${1 << 24}$${salt}$${digest}`)).toBe(false);
  });

  it("parses a hash this service issued", async () => {
    const h = await hashPassword("pw");
    const parsed = parseScryptHash(h);
    expect(parsed).not.toBeNull();
    expect(parsed?.n).toBe(16384);
    expect(parsed?.hash.length).toBe(64);
    expect(parseScryptHash("garbage")).toBeNull();
    expect(parseScryptHash("scrypt$16384$salt$")).toBeNull();
  });

  it("verifies a hash written with a different valid cost", async () => {
    // Proves the cost is genuinely read from the stored value rather than
    // assumed to be the one we issue.
    const salt = "aabbccdd00112233";
    const digest = await new Promise<Buffer>((resolve, reject) => {
      scrypt("pw", salt, 64, { N: 2048 }, (e, k) => (e ? reject(e) : resolve(k)));
    });
    const stored = `scrypt$2048$${salt}$${digest.toString("hex")}`;
    expect(parseScryptHash(stored)?.n).toBe(2048);
    expect(await verifyPassword("pw", stored)).toBe(true);
    expect(await verifyPassword("nope", stored)).toBe(false);
  });
});

describe("session tokens", () => {
  it("round-trips payload", () => {
    const token = buildSession({ userId: "usr_1", orgId: "org_1", sid: "abc" });
    const payload = verify(token);
    expect(payload).toEqual({ userId: "usr_1", orgId: "org_1", sid: "abc" });
  });

  it("detects tampering", () => {
    const token = buildSession({ userId: "usr_1", orgId: "org_1", sid: "abc" });
    const [body] = token.split(".");
    const forged = sign({ userId: "usr_evil", orgId: "org_1", sid: "abc" });
    expect(verify(forged)?.userId).toBe("usr_evil");
    expect(verify(`${body}.AAAA`)).toBeNull();
    expect(verify("not-a-token")).toBeNull();
  });

  it("rejects a token with extra segments", () => {
    const token = buildSession({ userId: "usr_1", orgId: "org_1", sid: "abc" });
    expect(verify(`${token}.anything`)).toBeNull();
    expect(verify(`.${token}`)).toBeNull();
  });

  it("rejects a token whose signature was swapped for another token's", () => {
    const a = buildSession({ userId: "usr_1", orgId: "org_1", sid: "aaa" });
    const b = buildSession({ userId: "usr_2", orgId: "org_1", sid: "bbb" });
    const [bodyA, sigB] = `${a.split(".")[0]}.${b.split(".")[1]}`.split(".");
    expect(verify(`${bodyA}.${sigB}`)).toBeNull();
  });
});

describe("rbac", () => {
  it("grants owner everything sensitive", () => {
    expect(can("owner", "billing:write")).toBe(true);
    expect(can("owner", "website:write")).toBe(true);
  });

  it("restricts analyst to reads", () => {
    expect(can("analyst", "issues:read")).toBe(true);
    expect(can("analyst", "issues:write")).toBe(false);
    expect(can("analyst", "crawl:run")).toBe(false);
  });

  it("restricts client to read-only", () => {
    expect(can("client", "reports:read")).toBe(true);
    expect(can("client", "actions:write")).toBe(false);
    expect(can("client", "billing:read")).toBe(false);
  });

  it("denies unknown roles", () => {
    expect(can("hacker", "website:read")).toBe(false);
  });
});
