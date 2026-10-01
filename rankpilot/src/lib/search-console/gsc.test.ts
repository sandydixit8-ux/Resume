import { describe, expect, it, vi } from "vitest";
import { generateKeyPairSync, verify, constants } from "node:crypto";
import {
  buildAssertion,
  exchangeToken,
  gscConfig,
  querySearchAnalytics,
  verifiedSiteFor,
  GSC_SCOPE,
} from "./gsc";

/** A throwaway RSA key pair so the signed JWT is verifiable for real. */
const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });

const CONFIG = { clientEmail: "svc@example.com", privateKey: privateKey.export({ type: "pkcs8", format: "pem" }).toString() };

describe("gscConfig", () => {
  it("fails closed when the service account credentials are absent", () => {
    const r = gscConfig({});
    expect("problem" in r).toBe(true);
    if ("problem" in r) expect(r.problem).toMatch(/GSC_CLIENT_EMAIL/);
  });

  it("accepts a complete configuration", () => {
    const r = gscConfig({ GSC_CLIENT_EMAIL: "a@b.c", GSC_PRIVATE_KEY: "PEM" });
    expect("config" in r).toBe(true);
  });
});

describe("buildAssertion", () => {
  it("produces a 3-part JWT with the right claims and a valid RS256 signature", () => {
    const jwt = buildAssertion(CONFIG, new Date("2026-01-01T00:00:00Z"));
    const [h, p, s] = jwt.split(".");
    expect(jwt.split(".")).toHaveLength(3);
    const header = JSON.parse(Buffer.from(h, "base64url").toString());
    const payload = JSON.parse(Buffer.from(p, "base64url").toString());
    expect(header.alg).toBe("RS256");
    expect(payload.iss).toBe(CONFIG.clientEmail);
    expect(payload.aud).toBe("https://oauth2.googleapis.com/token");
    expect(payload.scope).toBe(GSC_SCOPE);
    const sig = Buffer.from(s, "base64url");
    expect(
      verify(
        "sha256",
        Buffer.from(`${h}.${p}`),
        { key: publicKey, padding: constants.RSA_PKCS1_PADDING },
        sig
      )
    ).toBe(true);
  });

  it("accepts a PEM with escaped newlines, as a .env would need", () => {
    const cfg = {
      clientEmail: "svc@example.com",
      privateKey: CONFIG.privateKey.replace(/\n/g, "\\n"),
    };
    const jwt = buildAssertion(cfg, new Date("2026-01-01T00:00:00Z"));
    expect(jwt.split(".")).toHaveLength(3);
  });

  it("refuses a private key that is not valid PEM", () => {
    expect(() => buildAssertion({ clientEmail: "a@b", privateKey: "not-a-key" })).toThrow(/PEM/);
  });
});

describe("exchangeToken", () => {
  const fetchFn: ReturnType<typeof vi.fn<(url: string, init?: RequestInit) => Promise<Response>>> = vi.fn(
    async () => new Response(JSON.stringify({ access_token: "tok_123" }), { status: 200 })
  );

  it("posts the assertion and returns the access token", async () => {
    const token = await exchangeToken(CONFIG, fetchFn as unknown as typeof fetch, new Date("2026-01-01T00:00:00Z"));
    expect(token).toBe("tok_123");
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe("https://oauth2.googleapis.com/token");
    const body = new URLSearchParams(String(init?.body));
    expect(body.get("grant_type")).toBe("urn:ietf:params:oauth:grant-type:jwt-bearer");
    expect(body.get("assertion")).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  });

  it("throws when the endpoint rejects", async () => {
    const fetchFn = vi.fn(async () => new Response("nope", { status: 401 }));
    await expect(
      exchangeToken(CONFIG, fetchFn as unknown as typeof fetch, new Date("2026-01-01T00:00:00Z"))
    ).rejects.toThrow(/401/);
  });

  it("throws when the endpoint answers without an access token", async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ error_description: "invalid_grant" }), { status: 200 }));
    await expect(
      exchangeToken(CONFIG, fetchFn as unknown as typeof fetch, new Date("2026-01-01T00:00:00Z"))
    ).rejects.toThrow(/invalid_grant/);
  });
});

describe("querySearchAnalytics", () => {
  const row = { keys: ["seo tools"], clicks: 12, impressions: 400, ctr: 0.03, position: 9.2 };
  const okFetch: ReturnType<typeof vi.fn<(url: string, init?: RequestInit) => Promise<Response>>> = vi.fn(
    async () => new Response(JSON.stringify({ rows: [row], responseAggregationType: "byPage" }), { status: 200 })
  );

  it("queries the property endpoint with the date window and dimensions", async () => {
    await querySearchAnalytics(
      "tok_abc",
      { siteUrl: "https://example.com/", startDate: "2025-12-01", endDate: "2025-12-02", rowLimit: 100 },
      okFetch as unknown as typeof fetch
    );
    const [url, init] = okFetch.mock.calls[0];
    expect(url).toContain("/searchAnalytics/query");
    expect(url).toContain(encodeURIComponent("https://example.com/"));
    expect(new Headers(init!.headers).get("authorization")).toBe("Bearer tok_abc");
    const body = JSON.parse(String(init?.body));
    expect(body.startDate).toBe("2025-12-01");
    expect(body.endDate).toBe("2025-12-02");
    expect(body.dimensions).toEqual(["query"]);
    expect(body.rowLimit).toBe(100);
  });

  it("returns the rows as-is", async () => {
    const rows = await querySearchAnalytics("tok", { siteUrl: "x", startDate: "a", endDate: "b", rowLimit: 10 }, okFetch as unknown as typeof fetch);
    expect(rows).toEqual([{ keys: ["seo tools"], clicks: 12, impressions: 400, ctr: 0.03, position: 9.2 }]);
  });

  it("surfaces 403 as a typed no-access error rather than swallowing it", async () => {
    const denied = vi.fn(async () => new Response("forbidden", { status: 403 }));
    await expect(
      querySearchAnalytics("tok", { siteUrl: "x", startDate: "a", endDate: "b", rowLimit: 10 }, denied as unknown as typeof fetch)
    ).rejects.toThrow(/no_access/);
  });

  it("returns an empty list when Google reports no rows in the window", async () => {
    const empty = vi.fn(async () => new Response(JSON.stringify({}), { status: 200 }));
    const rows = await querySearchAnalytics("tok", { siteUrl: "x", startDate: "a", endDate: "b", rowLimit: 10 }, empty as unknown as typeof fetch);
    expect(rows).toEqual([]);
  });
});

describe("verifiedSiteFor", () => {
  const entries = [
    { siteUrl: "sc-domain:other.com" },
    { siteUrl: "sc-domain:example.com" },
    { siteUrl: "https://example.com/" },
  ];
  const okFetch = vi.fn(async () => new Response(JSON.stringify({ siteEntry: entries }), { status: 200 }));

  it("prefers an exact URL-prefix property for the host", async () => {
    const site = await verifiedSiteFor("tok", "https://example.com/home", okFetch as unknown as typeof fetch);
    expect(site).toEqual({ siteUrl: "https://example.com/", host: "example.com" });
  });

  it("falls back to the sc-domain property for the same host", async () => {
    const only = vi.fn(async () =>
      new Response(JSON.stringify({ siteEntry: [{ siteUrl: "sc-domain:example.com" }, { siteUrl: "sc-domain:other.com" }] }), { status: 200 })
    );
    const site = await verifiedSiteFor("tok", "https://example.com/x", only as unknown as typeof fetch);
    expect(site).toEqual({ siteUrl: "sc-domain:example.com", host: "example.com" });
  });

  it("returns null when no property matches the website", async () => {
    const site = await verifiedSiteFor("tok", "https://unlisted.com/", okFetch as unknown as typeof fetch);
    expect(site).toBeNull();
  });
});