import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A token-bearing link must never have its origin taken from the request.
 *
 * `new URL(req.url).origin` and `req.nextUrl.origin` are built from the
 * client-supplied Host header. Both the password-reset and email-verification
 * routes used them as a fallback when APP_URL was unset, which on a server that
 * accepts an arbitrary Host meant an attacker could request a reset with
 * `Host: evil.com` and the victim would receive a genuine reset email whose link
 * pointed at the attacker -- the token, and therefore the account, handed over.
 *
 * `linkBaseUrl()` in lib/site-url returns null instead of guessing, so these
 * routes fail closed. This scan exists to stop the fallback creeping back in.
 */

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(full));
    else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".test.ts")) out.push(full);
  }
  return out;
}

function code(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

const files = sourceFiles(join(process.cwd(), "src"));

describe("public URL source", () => {
  it("finds the source tree", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it("never derives a URL origin from the request", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const src = code(readFileSync(file, "utf8"));
      if (/new URL\(\s*req\.url\s*\)\.origin/.test(src)) offenders.push(file.replace(process.cwd(), ""));
      if (/req(uest)?\.nextUrl\.origin/.test(src)) offenders.push(file.replace(process.cwd(), ""));
      // Also catch a bare `new URL(req.url).href` used as a link prefix.
      if (/new URL\(\s*req\.url\s*\)\.href/.test(src)) offenders.push(file.replace(process.cwd(), ""));
    }
    expect(
      offenders,
      "use linkBaseUrl()/siteUrl() from lib/site-url, which never reads the Host header"
    ).toEqual([]);
  });

  it("sends no token link when the site URL is unconfigured", async () => {
    // The fail-closed half of the same boundary: both token routes must be able
    // to cope with a null base rather than falling back.
    const { linkBaseUrl } = await import("./site-url");
    expect(linkBaseUrl({})).toBeNull();

    for (const route of ["forgot-password", "resend-verification"]) {
      const src = readFileSync(
        join(process.cwd(), "src", "app", "api", "auth", route, "route.ts"),
        "utf8"
      );
      expect(src).toContain("linkBaseUrl()");
      expect(src).toMatch(/if \(!base\)/);
    }
  });

  it("reads the site URL from one resolver, not three spellings", () => {
    // The three-spellings bug meant a deploy following .env.example produced a
    // sitemap and canonical tags pointing at localhost. layout, robots and
    // sitemap must all go through lib/site-url.
    for (const file of [
      join("src", "app", "layout.tsx"),
      join("src", "app", "robots.ts"),
      join("src", "app", "sitemap.ts"),
    ]) {
      const src = readFileSync(join(process.cwd(), file), "utf8");
      expect(src, `${file} should import siteUrl`).toMatch(/from "@\/lib\/site-url"/);
      expect(src, `${file} should not read the env var directly`).not.toMatch(
        /process\.env\.NEXT_PUBLIC_SITE_URL/
      );
    }
  });
});
