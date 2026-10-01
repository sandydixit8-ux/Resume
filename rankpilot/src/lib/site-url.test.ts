import { describe, expect, it } from "vitest";
import { absoluteUrl, linkBaseUrl, siteUrl, siteUrlProblem, siteUrlSource } from "./site-url";
import { SITE_URL_ENV } from "./site-url-config";

describe("siteUrl", () => {
  it("prefers SITE_URL", () => {
    const env = {
      SITE_URL: "https://rankpilot.example",
      NEXT_PUBLIC_SITE_URL: "https://stale.example",
      APP_URL: "https://other.example",
    };
    expect(siteUrl(env)).toBe("https://rankpilot.example");
    expect(siteUrlSource(env)).toBe("SITE_URL");
  });

  it("accepts the older spellings so an existing deployment still works", () => {
    expect(siteUrl({ NEXT_PUBLIC_SITE_URL: "https://a.example" })).toBe("https://a.example");
    expect(siteUrl({ APP_URL: "https://b.example" })).toBe("https://b.example");
    expect(siteUrl({ RANKPILOT_PUBLIC_URL: "https://c.example" })).toBe("https://c.example");
  });

  it("strips trailing slashes and any path, returning the origin", () => {
    expect(siteUrl({ NEXT_PUBLIC_SITE_URL: "https://x.example/" })).toBe("https://x.example");
    expect(siteUrl({ NEXT_PUBLIC_SITE_URL: "https://x.example/pricing" })).toBe("https://x.example");
  });

  it("assumes https when the operator omitted a scheme", () => {
    // A missing scheme in an env file is a common mistake; the safe reading is
    // https, not http.
    expect(siteUrl({ NEXT_PUBLIC_SITE_URL: "rankpilot.example" })).toBe("https://rankpilot.example");
  });

  it("falls back to localhost when nothing is configured", () => {
    expect(siteUrl({})).toBe("http://localhost:3000");
    expect(siteUrlSource({})).toBeNull();
  });

  it("skips an unparseable value rather than returning it", () => {
    const env = { NEXT_PUBLIC_SITE_URL: "http://", APP_URL: "https://good.example" };
    expect(siteUrl(env)).toBe("https://good.example");
  });
});

describe("siteUrlProblem", () => {
  it("warns when the site URL is unset", () => {
    expect(siteUrlProblem({}, { production: false })).toMatch(/SITE_URL is not set/);
  });

  it("flags localhost in production, which silently unindexes a site", () => {
    // The bug this prevents: a deploy that followed .env.example had canonical,
    // sitemap and robots all pointing at localhost, with nothing failing.
    const problem = siteUrlProblem({ SITE_URL: "http://localhost:3000" }, { production: true });
    expect(problem).toMatch(/localhost/);
  });

  it("flags http in production", () => {
    expect(
      siteUrlProblem({ SITE_URL: "http://rankpilot.example" }, { production: true })
    ).toMatch(/https/);
  });

  it("accepts a correct https production URL", () => {
    expect(
      siteUrlProblem({ SITE_URL: "https://rankpilot.example" }, { production: true })
    ).toBeNull();
  });

  it("allows http on localhost for development", () => {
    expect(
      siteUrlProblem({ SITE_URL: "http://localhost:3000" }, { production: false })
    ).toBeNull();
  });
});

describe("the site URL variable name", () => {
  it("must not be NEXT_PUBLIC_ prefixed, which would bake it in at build time", () => {
    // This is a live trap, not a style preference. Next.js replaces
    // NEXT_PUBLIC_* values at BUILD time, so a server that sets the variable
    // only in its EnvironmentFile would still serve canonical tags, sitemap.xml
    // and robots.txt pointing at localhost. Every consumer here is
    // server-rendered and reads the value at runtime, so the canonical name must
    // not carry that prefix.
    expect(SITE_URL_ENV).toBe("SITE_URL");
    expect(SITE_URL_ENV.startsWith("NEXT_PUBLIC_")).toBe(false);
  });

  it("is the first candidate, so it wins over the deprecated spellings", () => {
    expect(siteUrlSource({ SITE_URL: "https://a.example", APP_URL: "https://b.example" })).toBe(
      SITE_URL_ENV
    );
  });
});

describe("absoluteUrl", () => {
  it("joins with exactly one slash", () => {
    const env = { NEXT_PUBLIC_SITE_URL: "https://x.example" };
    expect(absoluteUrl("/pricing", env)).toBe("https://x.example/pricing");
    expect(absoluteUrl("pricing", env)).toBe("https://x.example/pricing");
  });
});

describe("linkBaseUrl", () => {
  it("returns the configured origin", () => {
    expect(linkBaseUrl({ NEXT_PUBLIC_SITE_URL: "https://x.example" })).toBe("https://x.example");
  });

  it("returns null when unset rather than guessing", () => {
    // This is the host-header-injection boundary. There is intentionally no
    // fallback to a request-derived origin, so callers must fail closed.
    expect(linkBaseUrl({})).toBeNull();
  });
});
