import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateKeyPairSync, createSign } from "node:crypto";
import { NextRequest } from "next/server";
import { GET as callbackGet } from "@/app/api/auth/oauth/[provider]/callback/route";
import { createFlow } from "@/lib/auth/oauth/flow";
import { getDb } from "@/lib/db/db";
import { clearJwksCache } from "@/lib/auth/oauth/google";

// Google config is read from process.env at request time, so a real-looking
// client id exercises the configured path end to end.
const ORIG_ENV = { ...process.env };

const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const kid = "route-test-key";

function jwk() {
  const jwk = publicKey.export({ format: "jwk" }) as { n: string; e: string; kty: string };
  return { ...jwk, kid, alg: "RS256", use: "sig" };
}

function idToken(sub: string, email: string) {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", kid, typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      iss: "https://accounts.google.com",
      aud: "route-oauth-client",
      exp: Math.floor(Date.now() / 1000) + 3600,
      sub,
      email,
      email_verified: true,
      name: "Route User",
    })
  ).toString("base64url");
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${payload}`);
  const sig = Buffer.from(signer.sign(privateKey)).toString("base64url");
  return `${header}.${payload}.${sig}`;
}

const fetchMock = vi.fn();

const CALLBACK = "http://localhost/api/auth/oauth/google/callback";

function callbackReq(params?: { cookie?: string; state?: string; code?: string }) {
  const url = new URL(CALLBACK);
  url.searchParams.set("code", params?.code ?? "valid");
  url.searchParams.set("state", params?.state ?? "stale");
  return new NextRequest(url, {
    headers: params?.cookie ? { cookie: params.cookie } : {},
  });
}

describe("OAuth callback route", () => {
  beforeEach(() => {
    process.env.GOOGLE_CLIENT_ID = "route-oauth-client";
    process.env.GOOGLE_CLIENT_SECRET = "route-oauth-secret";
    delete process.env.AUTH_SECRET;
    clearJwksCache();
    fetchMock.mockReset();
  });
  afterEach(() => {
    process.env = { ...ORIG_ENV };
    vi.unstubAllGlobals();
  });

  it("redirects to the app with an error and no provider call when state mismatches", async () => {
    const res = await callbackGet(callbackReq({ state: "forged-state-for-another-flow" }), {
      params: Promise.resolve({ provider: "google" }),
    });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("oauth_error=login_failed");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("performs a full login: exchange, verified profile, session cookie, account created", async () => {
    const email = `e2e-${Date.now()}@example.com`;
    const sub = `route-sub-${Date.now()}`;
    const token = idToken(sub, email);
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ id_token: token }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ keys: [jwk()] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const redirectTo = "/dash";
    const flow = createFlow({ redirectTo, redirectUri: CALLBACK });

    const res = await callbackGet(
      callbackReq({ cookie: `rankpilot_oauth=${flow.cookieValue}`, state: flow.state }),
      { params: Promise.resolve({ provider: "google" }) }
    );
    expect(res.status).toBe(303);
    const location = new URL(res.headers.get("location")!);
    expect(location.pathname).toBe(redirectTo);
    expect(location.searchParams.has("oauth_error")).toBe(false);

    const cookies = res.headers.getSetCookie();
    const sessionCookie = cookies.find((c) => c.startsWith("rankpilot_session="));
    expect(sessionCookie).toBeTruthy();
    const cleared = cookies.find((c) => c.startsWith("rankpilot_oauth=") && c.includes("Max-Age=0"));
    expect(cleared).toBeTruthy();

    // The identity produced a fresh user + oauth link.
    const link = getDb()
      .prepare("SELECT user_id FROM oauth_accounts WHERE provider = 'google' AND provider_user_id = ?")
      .get(sub) as { user_id: string } | undefined;
    expect(link).toBeTruthy();
    const user = getDb()
      .prepare("SELECT email FROM users WHERE id = ?")
      .get(link!.user_id) as { email: string };
    expect(user.email).toBe(email);
  });

  it("rejects a reused code and leaves no session behind", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "invalid_grant" }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);
    const flow = createFlow({ redirectTo: "/app", redirectUri: CALLBACK });

    const res = await callbackGet(
      callbackReq({ cookie: `rankpilot_oauth=${flow.cookieValue}`, state: flow.state }),
      { params: Promise.resolve({ provider: "google" }) }
    );
    expect(res.status).toBe(303);
    const cookies = res.headers.getSetCookie();
    expect(cookies.some((c) => c.startsWith("rankpilot_oauth=") && c.includes("Max-Age=0"))).toBe(true);
    expect(cookies.some((c) => c.startsWith("rankpilot_session="))).toBe(false);
    expect(res.headers.get("location")).toContain("oauth_error=login_failed");
  });

  it("fails closed on a token signed by an unknown key", async () => {
    // Serve a JWKS with NO matching kid: signature verification has no key.
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ keys: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const flow = createFlow({ redirectTo: "/app", redirectUri: CALLBACK });

    const res = await callbackGet(
      callbackReq({ cookie: `rankpilot_oauth=${flow.cookieValue}`, state: flow.state }),
      { params: Promise.resolve({ provider: "google" }) }
    );
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("oauth_error=login_failed");
    const sessionCookie = res.headers
      .getSetCookie()
      .find((c) => c.startsWith("rankpilot_session="));
    expect(sessionCookie).toBeFalsy();
  });

  it("404s for an unknown provider", async () => {
    const res = await callbackGet(callbackReq(), {
      params: Promise.resolve({ provider: "twitter" }),
    });
    expect(res.status).toBe(404);
  });

  it("503s when Google is not configured", async () => {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    const res = await callbackGet(callbackReq(), {
      params: Promise.resolve({ provider: "google" }),
    });
    expect(res.status).toBe(503);
  });

  it("redirects with oauth_error when the identity cannot be resolved", async () => {
    // A sessionless deleted user scenario: identity maps to nothing usable.
    // email_verified=false never reaches Google's adapter in reality, but the
    // route must not 500 even if a provider sends it.
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const flow = createFlow({ redirectTo: "/app", redirectUri: CALLBACK });
    fetch.mockResolvedValue(new Response(JSON.stringify({ error: "invalid_grant" }), { status: 200 }));

    const res = await callbackGet(
      callbackReq({ cookie: `rankpilot_oauth=${flow.cookieValue}`, state: flow.state }),
      { params: Promise.resolve({ provider: "google" }) }
    );
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("oauth_error=login_failed");
  });
});