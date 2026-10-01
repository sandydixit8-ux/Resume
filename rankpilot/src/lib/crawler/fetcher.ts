import { lookup } from "node:dns/promises";
import { isPrivateHost } from "@/lib/url";

export const DEFAULT_UA =
  process.env.CRAWLER_USER_AGENT || "RankPilotBot/1.0 (+https://rankpilot.ai/bot)";
const TIMEOUT_MS = Number(process.env.CRAWLER_TIMEOUT_MS || 15000);
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 5;

export interface FetchResult {
  url: string;
  finalUrl: string;
  status: number;
  headers: Headers;
  text: string;
  bytes: number;
  ttfbMs: number;
}

export class FetchError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
  }
}

/**
 * A hostname can be public-looking and still resolve to 127.0.0.1 or the cloud
 * metadata address, so the string check above is not sufficient on its own.
 * Resolving here closes attacker-controlled DNS pointing inward.
 *
 * Residual risk: a hostile resolver could answer differently to this lookup and to
 * the fetch that follows (DNS rebinding). Closing that completely needs a pinned-IP
 * HTTP agent or an egress firewall rule — see docs/10-security-architecture.md.
 */
async function assertResolvesPublic(hostname: string): Promise<void> {
  let addrs: Array<{ address: string }>;
  try {
    addrs = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new FetchError("Host could not be resolved", "dns");
  }
  if (addrs.length === 0) throw new FetchError("Host could not be resolved", "dns");
  for (const a of addrs) {
    if (isPrivateHost(a.address)) {
      throw new FetchError("Blocked private address", "ssrf");
    }
  }
}

function assertFetchableUrl(raw: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new FetchError("Invalid URL", "invalid_url");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new FetchError("Unsupported protocol", "protocol");
  }
  if (isPrivateHost(parsed.hostname)) {
    throw new FetchError("Blocked private address", "ssrf");
  }
  return parsed;
}

/**
 * Fetch a URL with SSRF guard, timeout, body cap and polite headers.
 *
 * Redirects are followed by hand so every hop is re-validated. Letting `fetch`
 * follow them would send the request to an internal host before any check ran.
 */
export async function fetchText(
  rawUrl: string,
  opts: { userAgent?: string; accept?: string } = {}
): Promise<FetchResult> {
  let target = assertFetchableUrl(rawUrl);

  const started = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    let res: Response | null = null;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      await assertResolvesPublic(target.hostname);
      res = await fetch(target.toString(), {
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "User-Agent": opts.userAgent ?? DEFAULT_UA,
          Accept: opts.accept ?? "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en,*;q=0.5",
        },
      });
      const location = res.status >= 300 && res.status < 400 ? res.headers.get("location") : null;
      if (!location) break;
      // Drain and release the socket before the next hop.
      await res.body?.cancel().catch(() => undefined);
      let next: URL;
      try {
        next = new URL(location, target);
      } catch {
        throw new FetchError("Invalid redirect target", "invalid_url");
      }
      // Re-run the full guard on every hop, not just the protocol: a redirect is
      // attacker-controlled, so it gets the same private-host check as the entry URL.
      target = assertFetchableUrl(next.toString());
      if (hop === MAX_REDIRECTS) throw new FetchError("Too many redirects", "redirect");
    }
    if (!res) throw new FetchError("No response", "network");

    const ttfbMs = Date.now() - started;
    const reader = res.body?.getReader();
    let text = "";
    let bytes = 0;
    if (reader) {
      const decoder = new TextDecoder("utf-8", { fatal: false });
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > MAX_BODY_BYTES) {
          await reader.cancel().catch(() => undefined);
          break;
        }
        text += decoder.decode(value, { stream: true });
      }
      text += decoder.decode();
    }
    return {
      url: rawUrl,
      finalUrl: target.toString(),
      status: res.status,
      headers: res.headers,
      text,
      bytes,
      ttfbMs,
    };
  } catch (e) {
    if (e instanceof FetchError) throw e;
    if (e instanceof Error && e.name === "AbortError") {
      throw new FetchError("Request timed out", "timeout");
    }
    throw new FetchError(e instanceof Error ? e.message : "Network error", "network");
  } finally {
    clearTimeout(timeout);
  }
}

export interface RobotsRules {
  sitemaps: string[];
  disallowAll: boolean;
  disallows: string[];
}

export function parseRobots(text: string, userAgent: string = DEFAULT_UA): RobotsRules {
  const uaToken = userAgent.split("/")[0].toLowerCase();
  const lines = text.split(/\r?\n/);
  const groups: Array<{ agent: string; disallows: string[] }> = [];
  const sitemaps: string[] = [];
  let current: { agent: string; disallows: string[] } | null = null;

  for (const raw of lines) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const field = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (field === "sitemap") {
      sitemaps.push(value);
      continue;
    }
    if (field === "user-agent") {
      const agent = value.toLowerCase();
      if (!current || current.disallows.length > 0) {
        current = { agent, disallows: [] };
        groups.push(current);
      } else {
        current.agent = `${current.agent} ${agent}`;
      }
      continue;
    }
    if (field === "disallow" && current) {
      if (value === "") continue; // empty disallow = allow all
      current.disallows.push(value);
    }
  }

  const specific = groups.filter((g) => g.agent.split(/\s+/).some((a) => a.includes(uaToken)));
  const wildcard = groups.filter((g) => g.agent.split(/\s+/).some((a) => a === "*"));
  const chosen = specific.length > 0 ? specific : wildcard;
  const disallows = chosen.flatMap((g) => g.disallows);
  const disallowAll = chosen.some((g) => g.disallows.includes("/"));

  return { sitemaps, disallowAll, disallows };
}

export function isDisallowed(path: string, rules: RobotsRules): boolean {
  if (rules.disallowAll) return true;
  return rules.disallows.some((rule) => {
    if (!rule) return false;
    const prefix = rule.split("*")[0];
    return path.startsWith(prefix);
  });
}

export interface SitemapEntry {
  kind: "urlset" | "index";
  entries: Array<{ loc: string; lastmod?: string }>;
}

export function parseSitemap(xml: string): SitemapEntry {
  const isIndex = /<sitemapindex[\s>]/i.test(xml);
  const tag = isIndex ? "sitemap" : "url";
  const entries: SitemapEntry["entries"] = [];
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const block = m[1];
    const loc = /<loc>\s*([\s\S]*?)\s*<\/loc>/i.exec(block)?.[1]?.trim();
    if (!loc) continue;
    const lastmod = /<lastmod>\s*([\s\S]*?)\s*<\/lastmod>/i.exec(block)?.[1]?.trim();
    entries.push({ loc: decodeXml(loc), lastmod });
  }
  return { kind: isIndex ? "index" : "urlset", entries };
}

export function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}
