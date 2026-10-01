import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateKeyPairSync, createSign } from "node:crypto";
import {
  authorizationUrl,
  exchangeGoogleCode,
  JWKS_URL,
  TOKEN_URL,
  profileFromIdToken,
  clearJwksCache,
  verifyIdToken,
} from "./google";

// Generate a throwaway RSA key and mint real signed JWTs so the verification
// path is exercised for real (signature, aud, iss, expiry) rather than mocked.
const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });

function jwk(publicKey: ReturnType<typeof generateKeyPairSync>["publicKey"]) {
  const jwk = publicKey.export({ format: "jwk" }) as { n: string; e: string; kty: string };
  return { ...jwk, kid: "test-key-1", alg: "RS256", use: "sig" };
}

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString("base64url");
}

interface IdTokenClaims {
  iss: string;
  aud: string;
  exp: number;
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
}

function idToken(claims: Partial<IdTokenClaims> = {}): string {
  const full: IdTokenClaims = {
    iss: "https://accounts.google.com",
    aud: "test-client",
    exp: Math.floor(Date.now() / 1000) + 3600,
    sub: "google-abc-123",
    email: "test@example.com",
    email_verified: true,
    name: "Test User",
    ...claims,
  };
  const header = b64url(JSON.stringify({ alg: "RS256", kid: "test-key-1", typ: "JWT" }));
  const payload = b64url(JSON.stringify(full));
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${payload}`);
  const signature = b64url(signer.sign(privateKey));
  return `${header}.${payload}.${signature}`;
}

const fetchMock = vi.fn();

function jwksResponse() {
  return new Response(JSON.stringify({ keys: [jwk(publicKey)] }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("Google identity verification", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    clearJwksCache();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("accepts a well-formed id_token signed by the trusted key", async () => {
    vi.stubGlobal("fetch", fetchMock.mockResolvedValue(jwksResponse()));
    const token = idToken();
    const claims = await verifyIdToken(token, "test-client", fetchMock);
    expect(claims).toBeTruthy();
    expect(claims?.email).toBe("test@example.com");
    expect(claims?.sub).toBe("google-abc-123");
  });

  it("rejects a token signed by an unknown key", async () => {
    const { publicKey: otherPub } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    // JWKS serves a DIFFERENT key than the one that signed the token.
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ keys: [jwk(otherPub)] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    expect(await verifyIdToken(idToken(), "test-client", fetchMock)).toBeNull();
  });

  it("rejects a tampered payload", async () => {
    vi.stubGlobal("fetch", fetchMock.mockResolvedValue(jwksResponse()));
    const good = idToken();
    const [h, , sig] = good.split(".");
    const tamperedPayload = b64url(JSON.stringify({ email_verified: false, sub: "attacker" }));
    expect(await verifyIdToken(`${h}.${tamperedPayload}.${sig}`, "test-client", fetchMock)).toBeNull();
  });

  it("rejects a token for a different audience (our redirect was leaked elsewhere)", async () => {
    vi.stubGlobal("fetch", fetchMock.mockResolvedValue(jwksResponse()));
    expect(await verifyIdToken(idToken({ aud: "other-client" }), "test-client", fetchMock)).toBeNull();
  });

  it("rejects a token from an unexpected issuer", async () => {
    vi.stubGlobal("fetch", fetchMock.mockResolvedValue(jwksResponse()));
    expect(
      await verifyIdToken(idToken({ iss: "https://evil.example" }), "test-client", fetchMock)
    ).toBeNull();
  });

  it("rejects an expired token", async () => {
    vi.stubGlobal("fetch", fetchMock.mockResolvedValue(jwksResponse()));
    expect(
      await verifyIdToken(idToken({ exp: Math.floor(Date.now() / 1000) - 10 }), "test-client", fetchMock)
    ).toBeNull();
  });

  it("rejects a malformed token without calling the network", async () => {
    const fetchFn = vi.fn();
    expect(await verifyIdToken("not-a-jwt", "test-client", fetchFn)).toBeNull();
    expect(await verifyIdToken("a.b", "test-client", fetchFn)).toBeNull();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("turns token claims into a verified profile, rejecting unverified email", async () => {
    vi.stubGlobal("fetch", fetchMock.mockResolvedValue(jwksResponse()));
    const profile = await profileFromIdToken(idToken(), "test-client", fetchMock);
    expect(profile).toEqual({
      provider: "google",
      subject: "google-abc-123",
      email: "test@example.com",
      emailVerified: true,
      name: "Test User",
      picture: undefined,
    });
    const unverified = await profileFromIdToken(
      idToken({ email_verified: false }),
      "test-client",
      fetchMock
    );
    expect(unverified).toBeNull();
  });

  it("policy error from the token endpoint is surfaced, bad code is a clean null", async () => {
    const badButNotGrant = "<wf> Client is unauthorized</wf>";
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "access_denied", error_description: badButNotGrant }), {
        status: 200,
      })
    );
    await expect(
      exchangeGoogleCode(
        { clientId: "c", clientSecret: "s" },
        { code: "c1", verifier: "v1", redirectUri: "u", fetchFn: fetchMock }
      )
    ).rejects.toThrow(/Google token exchange error/);

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "invalid_grant" }), { status: 200 })
    );
    const result = await exchangeGoogleCode(
      { clientId: "c", clientSecret: "s" },
      { code: "c2", verifier: "v2", redirectUri: "u", fetchFn: fetchMock }
    );
    expect(result).toBeNull();
  });

  it("successfully exchanges a code and returns the verified profile", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ id_token: idToken() }), { status: 200 }))
      .mockResolvedValueOnce(jwksResponse());
    const profile = await exchangeGoogleCode(
      { clientId: "test-client", clientSecret: "s" },
      { code: "c", verifier: "v", redirectUri: "u", fetchFn: fetchMock }
    );
    expect(profile).toEqual(
      expect.objectContaining({ provider: "google", subject: "google-abc-123" })
    );
    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(TOKEN_URL);
    expect(String(fetchMock.mock.calls[1][0])).toBe(JWKS_URL);
  });

  it("builds a PKCE authorization URL with a challenge, never a verifier", async () => {
    const url = authorizationUrl(
      { clientId: "c", clientSecret: "s" },
      { state: "st", codeChallenge: "ch", redirectUri: "https://rp.example/cb" }
    );
    expect(url).toMatch(/^https:\/\/accounts\.google\.com\/o\/oauth2\/v2\/auth\?/);
    expect(url).toContain("state=st");
    expect(url).toContain("code_challenge=ch");
    expect(url).toContain("code_challenge_method=S256");
    expect(url).not.toContain("code_verifier=");
    expect(url).toContain(`redirect_uri=${encodeURIComponent("https://rp.example/cb")}`);
  });
});