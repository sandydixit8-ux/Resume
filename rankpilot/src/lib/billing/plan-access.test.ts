import { describe, expect, it } from "vitest";
import { selfServeAllowed, SELF_SERVE_ENV } from "./plan-access";

describe("selfServeAllowed", () => {
  it("denies everyone when the allowlist is unset (the default)", () => {
    // The regression this guards: with no env var set, a self-serve upgrade must
    // not be possible. If this test ever fails, anyone can claim the top tier.
    expect(selfServeAllowed("attacker@example.com", {})).toBe(false);
  });

  it("denies everyone when the allowlist is empty or whitespace", () => {
    expect(selfServeAllowed("a@example.com", { [SELF_SERVE_ENV]: "" })).toBe(false);
    expect(selfServeAllowed("a@example.com", { [SELF_SERVE_ENV]: "   " })).toBe(false);
  });

  it("allows an explicitly listed account", () => {
    expect(
      selfServeAllowed("owner@example.com", { [SELF_SERVE_ENV]: "owner@example.com" })
    ).toBe(true);
  });

  it("allows a listed account among several", () => {
    const env = { [SELF_SERVE_ENV]: "a@example.com, b@example.com" };
    expect(selfServeAllowed("b@example.com", env)).toBe(true);
    expect(selfServeAllowed("c@example.com", env)).toBe(false);
  });

  it("ignores case and surrounding whitespace on both sides", () => {
    const env = { [SELF_SERVE_ENV]: " Owner@Example.COM ,other@example.com" };
    expect(selfServeAllowed("owner@example.com", env)).toBe(true);
    expect(selfServeAllowed("  OWNER@example.com  ", env)).toBe(true);
  });

  it("does not treat an empty list entry as a wildcard", () => {
    // "," parses to zero entries; a stray empty item must never match "".
    const env = { [SELF_SERVE_ENV]: "a@example.com,," };
    expect(selfServeAllowed("", env)).toBe(false);
    expect(selfServeAllowed("a@example.com", env)).toBe(true);
  });

  it("is not fooled by a substring or a different domain", () => {
    const env = { [SELF_SERVE_ENV]: "owner@example.com" };
    expect(selfServeAllowed("notowner@example.com", env)).toBe(false);
    expect(selfServeAllowed("owner@example.com.evil.test", env)).toBe(false);
  });
});
