import { describe, it, expect } from "vitest";
import { renderTokens, buildUnsubscribeUrl } from "./mailer";
import { verify } from "@/lib/auth/session";

describe("mailer renderTokens", () => {
  it("replaces {{placeholder}} with values", () => {
    expect(renderTokens("Hi {{name}}, your email is {{email}}", { name: "Aqui", email: "a@b.co" })).toBe(
      "Hi Aqui, your email is a@b.co"
    );
  });

  it("tolerates whitespace inside braces", () => {
    expect(renderTokens("Hello {{ name }}!", { name: "X" })).toBe("Hello X!");
  });

  it("empties unknown tokens", () => {
    expect(renderTokens("a {{missing}} b", {})).toBe("a  b");
  });

  it("handles numeric values", () => {
    expect(renderTokens("Count: {{count}}", { count: 12 })).toBe("Count: 12");
  });

  it("renders unsubscribe url token", () => {
    const out = renderTokens('<a href="{{unsubscribe_url}}">unsub</a>', { unsubscribe_url: "https://x/y" });
    expect(out).toContain("https://x/y");
  });
});

describe("mailer buildUnsubscribeUrl", () => {
  it("emits a signed token carrying the tenant and email", () => {
    const url = buildUnsubscribeUrl("org_abc", "fan@example.com");
    const token = new URL(url).searchParams.get("t") || "";
    const payload = verify(token);
    expect(payload?.scope).toBe("email_unsubscribe");
    expect(payload?.tenantId).toBe("org_abc");
    expect(payload?.email).toBe("fan@example.com");
  });

  it("fails to verify tampered tokens", () => {
    const payload = verify("Zm9v.eWVsbA");
    expect(payload).toBeNull();
  });
});