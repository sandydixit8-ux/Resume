import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DECOY_HASH, parseScryptHash, verifyPassword } from "./password";

const loginRoute = readFileSync(
  join(process.cwd(), "src", "app", "api", "auth", "login", "route.ts"),
  "utf8"
);

describe("login does not enumerate accounts by timing", () => {
  it("has a usable decoy hash that nothing matches", async () => {
    // It must parse and must run the real KDF, otherwise equalising is fake.
    expect(parseScryptHash(DECOY_HASH)).not.toBeNull();
    expect(parseScryptHash(DECOY_HASH)?.n).toBe(16384);
    expect(await verifyPassword("anything", DECOY_HASH)).toBe(false);
    expect(await verifyPassword("", DECOY_HASH)).toBe(false);
  });

  it("verifies the password before deciding whether the account exists", () => {
    // The vulnerable form short-circuits: `!user || ... || !(await verify(...))`
    // skips the KDF entirely for an unknown email.
    expect(loginRoute).not.toMatch(/!\w+\s*\|\|[^;]*\|\|?\s*!?\s*\(?\s*await verifyPassword/);
    expect(loginRoute).toMatch(/await verifyPassword\(/);
  });

  it("falls back to the decoy when there is no usable account", () => {
    expect(loginRoute).toMatch(/DECOY_HASH/);
    // The decoy must be selected before the branch that rejects the request.
    const decoyAt = loginRoute.indexOf("DECOY_HASH");
    const rejectAt = loginRoute.indexOf("return genericError");
    expect(decoyAt).toBeGreaterThan(-1);
    expect(rejectAt).toBeGreaterThan(decoyAt);
  });

  it("returns the same error shape regardless of which path failed", () => {
    // One generic message for: unknown email, wrong password, soft-deleted
    // account, and an account with no membership.
    const generic = /code: "validation", message: "Invalid email or password\."/;
    expect(loginRoute).toMatch(generic);
    // The combined account check, plus the membership check.
    expect(loginRoute.match(/return genericError;/g)?.length).toBe(2);
    // No branch may leak a more specific reason.
    expect(loginRoute).not.toMatch(/message: "No membership|message: "Unknown user|message: "User not found/);
  });
});
