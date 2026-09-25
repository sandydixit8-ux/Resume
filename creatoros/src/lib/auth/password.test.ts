import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("password hashing", () => {
  it("hashes and verifies a valid password", () => {
    const stored = hashPassword("Demo1234!");
    expect(stored).toContain(":");
    expect(verifyPassword("Demo1234!", stored)).toBe(true);
  });

  it("rejects a wrong password", () => {
    const stored = hashPassword("correct-horse");
    expect(verifyPassword("wrong", stored)).toBe(false);
  });

  it("rejects malformed stored hashes", () => {
    expect(verifyPassword("anything", "not-a-hash")).toBe(false);
    expect(verifyPassword("anything", "")).toBe(false);
  });

  it("generates unique salts per hash", () => {
    expect(hashPassword("same-pass")).not.toBe(hashPassword("same-pass"));
  });
});