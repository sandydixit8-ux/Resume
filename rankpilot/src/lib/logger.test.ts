import { describe, expect, it, vi } from "vitest";
import { describeError, log, redact } from "./logger";

function capture(fn: () => void): string {
  const spy = vi.spyOn(process.stdout, "write").mockReturnValue(true);
  try {
    fn();
    return spy.mock.calls.map((c) => String(c[0])).join("");
  } finally {
    spy.mockRestore();
  }
}

describe("structured logger", () => {
  it("emits one parseable JSON object per line", () => {
    const out = capture(() => log.info("job completed", { jobId: "job_1", durationMs: 12 }));
    expect(out.endsWith("\n")).toBe(true);
    expect(out.trimEnd().split("\n")).toHaveLength(1);
    const parsed = JSON.parse(out);
    expect(parsed).toMatchObject({ level: "info", msg: "job completed", jobId: "job_1", durationMs: 12 });
    expect(typeof parsed.ts).toBe("string");
  });

  it("redacts secrets instead of writing them", () => {
    const out = capture(() =>
      log.error("auth attempt", {
        password: "hunter2",
        token: "abc",
        AUTH_SECRET: "s3cret",
        apiKey: "sk-live-123",
        cookie: "session=xyz",
        userId: "usr_1",
      })
    );
    expect(out).not.toContain("hunter2");
    expect(out).not.toContain("sk-live-123");
    expect(out).not.toContain("s3cret");
    // Non-secret context must survive, or the log is useless.
    expect(out).toContain("usr_1");
  });

  it("redacts secrets nested inside objects", () => {
    const out = capture(() => log.info("ctx", { session: { token: "leak-me" } }));
    expect(out).not.toContain("leak-me");
  });

  it("is case-insensitive about secret keys", () => {
    expect(redact({ PassWord: "x", ToKeN: "y" })).toEqual({ PassWord: "[redacted]", ToKeN: "[redacted]" });
  });

  it("distinguishes the levels an operator alerts on", () => {
    expect(JSON.parse(capture(() => log.warn("reaped"))).level).toBe("warn");
    expect(JSON.parse(capture(() => log.error("failed"))).level).toBe("error");
  });

  it("normalizes thrown values without losing the message", () => {
    expect(describeError(new TypeError("bad input"))).toEqual({ name: "TypeError", message: "bad input" });
    expect(describeError("plain string").message).toBe("plain string");
    expect(describeError({ weird: true }).name).toBe("Unknown");
  });

  it("survives a value that cannot be serialised", () => {
    // A circular object in a log field must not take down the caller.
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    const out = capture(() => log.info("circular", { circular }));
    expect(out).toContain("circular");
  });
});
