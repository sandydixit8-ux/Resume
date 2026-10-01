import { describe, expect, it } from "vitest";
import { FreeAuditError, runFreeAudit } from "@/lib/audit/free";

describe("free audit validation", () => {
  it("rejects malformed URLs before any network call", async () => {
    await expect(
      runFreeAudit({ url: "definitely not a url", ip: "127.0.0.1" })
    ).rejects.toMatchObject({ code: "invalid_url" });
  });

  it("rejects non-http schemes", async () => {
    await expect(
      runFreeAudit({ url: "ftp://example.com", ip: "127.0.0.1" })
    ).rejects.toBeInstanceOf(FreeAuditError);
  });

  it("blocks private and loopback addresses (SSRF)", async () => {
    await expect(
      runFreeAudit({ url: "http://192.168.1.10/admin", ip: "127.0.0.1" })
    ).rejects.toMatchObject({ code: "fetch_failed" });

    await expect(
      runFreeAudit({ url: "http://127.0.0.1/", ip: "127.0.0.1" })
    ).rejects.toMatchObject({ code: "fetch_failed" });
  });
});
