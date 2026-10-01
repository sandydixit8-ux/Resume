import { describe, expect, it } from "vitest";
import {
  assertPublicHttpUrl,
  isPrivateHost,
  normalizeUrlKey,
  normalizeWebsiteUrl,
  registrableDomain,
  resolveUrl,
  sameRegistrableDomain,
  UrlError,
} from "@/lib/url";

describe("normalizeWebsiteUrl", () => {
  it("adds https when protocol missing", () => {
    const r = normalizeWebsiteUrl("example.com");
    expect(r.origin).toBe("https://example.com");
    expect(r.normalized).toBe("https://example.com");
  });

  it("strips trailing slash and hash", () => {
    const r = normalizeWebsiteUrl("https://example.com/blog/#section");
    expect(r.normalized).toBe("https://example.com/blog");
  });

  it("rejects garbage", () => {
    expect(() => normalizeWebsiteUrl("")).toThrow(UrlError);
    expect(() => normalizeWebsiteUrl("ht!tp://??")).toThrow(UrlError);
  });

  it("rejects non-http protocols", () => {
    expect(() => normalizeWebsiteUrl("ftp://example.com")).toThrow(UrlError);
    expect(() => normalizeWebsiteUrl("javascript:alert(1)")).toThrow(UrlError);
  });
});

describe("normalizeUrlKey", () => {
  it("removes tracking params and sorts the rest", () => {
    const a = normalizeUrlKey(new URL("https://Example.com/p?b=2&a=1&utm_source=x"));
    const b = normalizeUrlKey(new URL("https://example.com/p?a=1&b=2"));
    expect(a).toBe(b);
    expect(a).toBe("https://example.com/p?a=1&b=2");
  });

  it("keeps meaningful params", () => {
    expect(normalizeUrlKey(new URL("https://example.com/?page=2"))).toBe(
      "https://example.com?page=2"
    );
  });
});

describe("SSRF guard", () => {
  it("flags private hosts", () => {
    expect(isPrivateHost("localhost")).toBe(true);
    expect(isPrivateHost("127.0.0.1")).toBe(true);
    expect(isPrivateHost("10.1.2.3")).toBe(true);
    expect(isPrivateHost("172.16.0.1")).toBe(true);
    expect(isPrivateHost("192.168.1.1")).toBe(true);
    expect(isPrivateHost("169.254.169.254")).toBe(true);
    expect(isPrivateHost("::1")).toBe(true);
    expect(isPrivateHost("example.com")).toBe(false);
    expect(isPrivateHost("8.8.8.8")).toBe(false);
  });

  it("blocks private urls", () => {
    expect(() => assertPublicHttpUrl("http://127.0.0.1")).toThrow(UrlError);
    expect(() => assertPublicHttpUrl("http://169.254.169.254")).toThrow(UrlError);
    expect(() => assertPublicHttpUrl("https://example.com")).not.toThrow();
  });

  /**
   * Every one of these reached the crawler before: a tenant could add such a site
   * and have the fetcher talk to the local network or the cloud metadata service.
   */
  it("blocks encodings that reach loopback or metadata", () => {
    const bypasses = [
      "http://localhost./", // trailing dot is the DNS root
      "http://LOCALHOST./", // case folded
      "http://127.0.0.1./",
      "http://[::ffff:127.0.0.1]/", // WHATWG rewrites this to ::ffff:7f00:1
      "http://[::ffff:7f00:1]/",
      "http://[0:0:0:0:0:ffff:7f00:1]/",
      "http://127.1/", // shorthand IPv4
      "http://2130706433/", // decimal IPv4
      "http://0x7f000001/", // hex IPv4
      "http://017700000001/", // octal IPv4
      "http://metadata.google.internal/",
      "http://metadata.goog/",
      "http://instance-data/latest/meta-data/",
      "http://10.0.0.5/",
      "http://100.64.0.1/", // carrier-grade NAT
      "http://[fd00::1]/",
      "http://[fe80::1]/",
      "http://foo.local/",
    ];
    for (const raw of bypasses) {
      let host: string;
      try {
        host = new URL(raw).hostname;
      } catch {
        throw new Error(`test case is not a parseable url: ${raw}`);
      }
      expect(isPrivateHost(host), `${raw} (hostname ${host}) must be treated as private`).toBe(true);
      expect(() => assertPublicHttpUrl(raw), `${raw} must be rejected`).toThrow(UrlError);
    }
  });

  it("still allows genuinely public hosts", () => {
    for (const host of ["example.com", "8.8.8.8", "www.example.co.uk", "sub.domain.example.org"]) {
      expect(isPrivateHost(host), `${host} must not be treated as private`).toBe(false);
    }
  });
});

describe("domain helpers", () => {
  it("computes registrable domain", () => {
    expect(registrableDomain("https://www.blog.example.com/x")).toBe("example.com");
    expect(sameRegistrableDomain("https://a.example.com", "https://b.example.com")).toBe(true);
    expect(sameRegistrableDomain("https://example.com", "https://other.com")).toBe(false);
  });

  it("resolves relative links", () => {
    expect(resolveUrl("/about", "https://example.com")).toBe("https://example.com/about");
    expect(resolveUrl("mailto:x@example.com", "https://example.com")).toBeNull();
    expect(resolveUrl("notaurl", "https://example.com")).toBe("https://example.com/notaurl");
  });
});
