import { describe, expect, it } from "vitest";
import { sanitizeRequestId } from "./request-context";

describe("request id sanitization", () => {
  it("generates an id when none is supplied", () => {
    const id = sanitizeRequestId(null);
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("generates an id for an empty or unusable value", () => {
    expect(sanitizeRequestId("")).toMatch(/^[0-9a-f-]{36}$/);
    expect(sanitizeRequestId("///")).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("keeps a well-formed inbound id so a gateway id survives", () => {
    expect(sanitizeRequestId("req-abc123.XYZ_9")).toBe("req-abc123.XYZ_9");
  });

  it("strips characters that could forge a log field", () => {
    // A newline in a header value is the classic log-injection vector: it can
    // fabricate an entire extra log line.
    const dirty = sanitizeRequestId('abc\n{"level":"info","msg":"forged"}');
    expect(dirty).not.toContain("\n");
    expect(dirty).not.toContain('"');
    expect(dirty).not.toContain("{");
    expect(dirty).not.toContain("}");
  });

  it("bounds the length", () => {
    const long = sanitizeRequestId("a".repeat(500));
    expect(long.length).toBeLessThanOrEqual(64);
  });

  it("does not let a caller impersonate a log level or field", () => {
    for (const hostile of ['x"level":"error','x,y=1', "x\nlevel: error", "x`whoami`"]) {
      const clean = sanitizeRequestId(hostile);
      expect(clean, hostile).not.toMatch(/["\n\r,`]/);
    }
  });
});
