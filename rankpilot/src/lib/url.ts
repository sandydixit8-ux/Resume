export const TRACKING_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "fbclid",
  "mc_cid",
  "mc_eid",
  "ref",
];

export interface NormalizedUrl {
  origin: string;
  normalized: string;
  urlKey: string;
}

export class UrlError extends Error {}

/** Normalize a user-supplied website URL to a crawlable origin. */
export function normalizeWebsiteUrl(input: string): NormalizedUrl {
  const raw = input.trim();
  if (!raw) throw new UrlError("Enter a website URL.");
  const scheme = raw.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/);
  if (scheme) {
    const proto = scheme[1].toLowerCase();
    if (proto !== "http" && proto !== "https") {
      throw new UrlError("Only http and https URLs are supported.");
    }
    if (!/^https?:\/\//i.test(raw)) {
      throw new UrlError("That doesn't look like a valid URL.");
    }
  }
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  let u: URL;
  try {
    u = new URL(withProtocol);
  } catch {
    throw new UrlError("That doesn't look like a valid URL.");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new UrlError("Only http and https URLs are supported.");
  }
  if (!isValidHostname(u.hostname)) {
    throw new UrlError("That doesn't look like a valid URL.");
  }
  u.hash = "";
  const port = u.port && u.port !== "80" && u.port !== "443" ? `:${u.port}` : "";
  const origin = `${u.protocol}//${u.hostname}${port}`;
  const normalized = origin + normalizePath(u.pathname);
  return { origin, normalized, urlKey: normalizeUrlKey(u) };
}

function isValidHostname(hostname: string): boolean {
  if (!hostname) return false;
  if (hostname.startsWith("[") && hostname.endsWith("]")) {
    return /^[0-9a-f:.]+$/i.test(hostname.slice(1, -1));
  }
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) return true;
  if (hostname.length > 253) return false;
  return hostname
    .split(".")
    .every(
      (label) =>
        label.length > 0 &&
        label.length <= 63 &&
        /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/i.test(label)
    );
}

function normalizePath(pathname: string): string {
  if (pathname === "/") return "";
  return pathname.replace(/\/+$/, "");
}

/** Stable dedupe key: lowercase host, sorted query minus tracking params, no fragment. */
export function normalizeUrlKey(u: URL): string {
  const protocol = u.protocol.toLowerCase();
  const host = u.hostname.toLowerCase();
  const port = u.port && u.port !== "80" && u.port !== "443" ? `:${u.port}` : "";
  const params = [...u.searchParams.entries()]
    .filter(([k]) => !TRACKING_PARAMS.includes(k.toLowerCase()))
    .sort(([a, av], [b, bv]) => (a === b ? av.localeCompare(bv) : a.localeCompare(b)));
  const qs = params.length
    ? "?" + params.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&")
    : "";
  return `${protocol}//${host}${port}${normalizePath(u.pathname)}${qs}`;
}

export function urlKeyOf(url: string): string {
  return normalizeUrlKey(new URL(url));
}

const METADATA_HOSTS = new Set([
  "metadata.google.internal",
  "metadata.goog",
  "instance-data",
  "instance-data.ec2.internal",
]);

export function isPrivateHost(hostname: string): boolean {
  // A trailing dot is the DNS root ("localhost." === "localhost"); WHATWG keeps it
  // in hostname, so strip it before matching or the guard is trivially bypassed.
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local")) return true;
  if (h === "0.0.0.0" || h === "::" || h === "::1" || h === "0") return true;
  // Known cloud metadata hostnames resolve to link-local addresses, so they must be
  // named explicitly — a DNS lookup alone is not enough if DNS itself is hostile.
  if (METADATA_HOSTS.has(h)) return true;
  const v4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true; // link-local / cloud metadata
    if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
    if (a === 192 && b === 0) return true; // IETF protocol assignments
    if (a >= 224) return true; // multicast + reserved
    return false;
  }
  if (h.includes(":")) {
    // IPv6 unique-local
    if (h.startsWith("fc") || h.startsWith("fd")) return true;
    if (h.startsWith("fe80")) return true;
    // IPv4-mapped/compatible IPv6. WHATWG normalizes "::ffff:127.0.0.1" to the hex
    // form "::ffff:7f00:1", so the dotted tail is not always there to re-check.
    const mapped = h.match(/^::(?:ffff:)?([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (mapped) {
      const hi = parseInt(mapped[1], 16);
      const lo = parseInt(mapped[2], 16);
      const dotted = `${hi >> 8}.${hi & 0xff}.${lo >> 8}.${lo & 0xff}`;
      return isPrivateHost(dotted);
    }
    return false;
  }
  return false;
}

/** Throws when the URL points at a private/loopback/metadata address. */
export function assertPublicHttpUrl(raw: string): URL {
  const { normalized } = normalizeWebsiteUrl(raw);
  const u = new URL(normalized);
  if (isPrivateHost(u.hostname)) {
    throw new UrlError("Private or local addresses are not allowed.");
  }
  return u;
}

export function sameRegistrableDomain(a: string, b: string): boolean {
  return registrableDomain(a) === registrableDomain(b);
}

/** Simplified registrable domain (last two labels; good enough for internal/external split). */
export function registrableDomain(urlOrHost: string): string {
  let host = urlOrHost;
  try {
    host = new URL(urlOrHost).hostname;
  } catch {
    host = urlOrHost.replace(/^https?:\/\//i, "").split("/")[0];
  }
  host = host.toLowerCase().replace(/:\d+$/, "");
  const parts = host.split(".").filter(Boolean);
  if (parts.length <= 2) return host;
  return parts.slice(-2).join(".");
}

export function resolveUrl(href: string, base: string): string | null {
  try {
    const u = new URL(href, base);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    u.hash = "";
    return u.toString();
  } catch {
    return null;
  }
}
