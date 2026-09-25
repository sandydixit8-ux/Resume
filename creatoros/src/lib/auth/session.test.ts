import { describe, it, expect } from "vitest";
import { sign, verify, buildSession, setSessionCookie, getSessionCookie } from "./session";

describe("session signing", () => {
  it("signs and verifies a payload", () => {
    const token = sign({ userId: "usr_1", orgId: "org_1" });
    expect(verify(token)).toEqual({ userId: "usr_1", orgId: "org_1" });
  });

  it("rejects tampered tokens", () => {
    const token = sign({ userId: "usr_1", orgId: "org_1" });
    const [body, sig] = token.split(".");
    // flip a char in the signature
    const bogusSig = sig.slice(0, -1) + (sig.endsWith("A") ? "B" : "A");
    expect(verify(`${body}.${bogusSig}`)).toBeNull();
  });

  it("rejects garbage tokens", () => {
    expect(verify("")).toBeNull();
    expect(verify("no.dots.here")).toBeNull();
    expect(verify("!!")).toBeNull();
  });

  it("builds a session from ids", () => {
    const token = buildSession({ userId: "u", orgId: "o" });
    expect(verify(token)).toEqual({ userId: "u", orgId: "o" });
  });
});

describe("session cookie helpers", () => {
  it("sets and extracts the cookie", () => {
    const header = setSessionCookie("usr_1", "org_1");
    expect(header.startsWith("creatoros_session=")).toBe(true);
    expect(header).toContain("HttpOnly");
    expect(header).toContain("SameSite=Lax");
    expect(getSessionCookie(header)).toBeTruthy();
  });

  it("extracts from multi-cookie headers", () => {
    const header = `other=1; ${setSessionCookie("usr_1", "org_1")}; foo=bar`;
    expect(getSessionCookie(header)).toBe(setSessionCookie("usr_1", "org_1").slice(18).split(";")[0]);
  });

  it("returns null without a session cookie", () => {
    expect(getSessionCookie(null)).toBeNull();
    expect(getSessionCookie("token=abc")).toBeNull();
  });
});