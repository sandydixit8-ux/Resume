import { describe, expect, it } from "vitest";
import { fetchText, FetchError } from "./fetcher";

/** `localhost` resolves to 127.0.0.1 without touching the network. */
describe("fetchText SSRF guard", () => {
  it("rejects a literal private address before any request", async () => {
    await expect(fetchText("http://127.0.0.1/")).rejects.toThrow(FetchError);
    await expect(fetchText("http://localhost./")).rejects.toThrow(FetchError);
  });

  it("rejects non-http protocols", async () => {
    await expect(fetchText("file:///etc/passwd")).rejects.toThrow(FetchError);
    await expect(fetchText("gopher://127.0.0.1/")).rejects.toThrow(FetchError);
  });

  it("rejects unparseable urls", async () => {
    await expect(fetchText("not a url")).rejects.toThrow(FetchError);
    await expect(fetchText("")).rejects.toThrow(FetchError);
  });

  it("reports the ssrf code rather than a generic network error", async () => {
    await expect(fetchText("http://169.254.169.254/latest/meta-data/")).rejects.toMatchObject({
      code: "ssrf",
    });
  });

  it("rejects a public-looking hostname that resolves inward", async () => {
    // localhost passes the string check (it is not an IP literal) but resolves to
    // loopback, so the DNS layer has to be the thing that stops it.
    await expect(fetchText("http://localhost/")).rejects.toMatchObject({ code: "ssrf" });
  });

  it("fails closed when a host cannot be resolved", async () => {
    await expect(
      fetchText("http://this-host-does-not-exist-rankpilot-test.invalid/")
    ).rejects.toMatchObject({ code: "dns" });
  });
});
