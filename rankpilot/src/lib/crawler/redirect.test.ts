import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// The fetcher resolves DNS before every hop, so both layers are stubbed to make the
// redirect path testable without a network — and without a test server, which would
// have to listen on a private address the SSRF guard (correctly) refuses to fetch.
const lookupMock = vi.hoisted(() => vi.fn());
vi.mock("node:dns/promises", () => ({ lookup: lookupMock }));

import { fetchText } from "./fetcher";

const PUBLIC = [{ address: "93.184.216.34" }];

function redirectResponse(location: string): Response {
  return new Response(null, { status: 302, headers: { location } });
}

describe("fetchText redirect handling", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    lookupMock.mockReset();
    lookupMock.mockResolvedValue(PUBLIC);
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("never delegates redirect following to the http client", async () => {
    fetchMock.mockResolvedValue(new Response("<html>ok</html>", { status: 200 }));
    await fetchText("https://example.com/");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ redirect: "manual" });
  });

  it("blocks a redirect that points at the metadata service before requesting it", async () => {
    fetchMock.mockResolvedValueOnce(redirectResponse("http://169.254.169.254/latest/meta-data/"));
    await expect(fetchText("https://example.com/")).rejects.toMatchObject({ code: "ssrf" });
    // The second hop must never be requested.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("blocks a redirect to a hostname that resolves inward", async () => {
    fetchMock.mockResolvedValueOnce(redirectResponse("http://internal.test/"));
    lookupMock.mockImplementation(async (hostname: string) =>
      hostname === "internal.test" ? [{ address: "127.0.0.1" }] : PUBLIC
    );
    await expect(fetchText("https://example.com/")).rejects.toMatchObject({ code: "ssrf" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("blocks a redirect that changes protocol", async () => {
    fetchMock.mockResolvedValueOnce(redirectResponse("file:///etc/passwd"));
    await expect(fetchText("https://example.com/")).rejects.toMatchObject({ code: "protocol" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("follows a legitimate redirect chain and reports the final url", async () => {
    fetchMock
      .mockResolvedValueOnce(redirectResponse("/next"))
      .mockResolvedValueOnce(new Response("<html>done</html>", { status: 200 }));
    const res = await fetchText("https://example.com/start");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(res.status).toBe(200);
    expect(res.finalUrl).toBe("https://example.com/next");
    expect(res.text).toContain("done");
  });

  it("stops after too many redirects", async () => {
    fetchMock.mockImplementation(async () => redirectResponse("https://example.com/loop"));
    await expect(fetchText("https://example.com/")).rejects.toMatchObject({ code: "redirect" });
    expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(6);
  });

  it("re-checks dns on every hop", async () => {
    fetchMock
      .mockResolvedValueOnce(redirectResponse("https://second.test/"))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    await fetchText("https://example.com/");
    expect(lookupMock).toHaveBeenCalledTimes(2);
  });
});
