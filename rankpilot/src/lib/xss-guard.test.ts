import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Crawled page text and AI output are attacker-controlled. The protection is
 * React's escaping of children, which only holds while nothing bypasses it, so
 * this asserts the bypass does not exist rather than trusting the convention.
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

const files = sourceFiles(join(process.cwd(), "src"));

/** Strips comments so documentation of a risk is not mistaken for the risk. */
function code(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

describe("xss guards", () => {
  it("finds the source tree", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it("never assigns raw HTML from crawled or generated content", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const src = code(readFileSync(file, "utf8"));
      // One sanctioned exception: emitting a <script type="application/ld+json">
      // block. React offers no declarative way to do that, and the value cannot
      // be expressed as children. It is permitted only in a file that routes the
      // value through serializeJsonLd(), which escapes "<" so the value cannot
      // close the script tag early. Everything else stays forbidden.
      const isSanctionedJsonLd =
        /dangerouslySetInnerHTML/.test(src) && /serializeJsonLd\(/.test(src);
      if (/dangerouslySetInnerHTML/.test(src) && !isSanctionedJsonLd) {
        offenders.push(file.replace(process.cwd(), ""));
      }
      // document.write / outerHTML / insertAdjacentHTML are equivalent bypasses.
      if (/\.(innerHTML|outerHTML)\s*=/.test(src)) offenders.push(file.replace(process.cwd(), ""));
      if (/insertAdjacentHTML|document\.write\(/.test(src)) offenders.push(file.replace(process.cwd(), ""));
    }
    expect(offenders, "render untrusted content as React children so it is escaped").toEqual([]);
  });

  it("cannot be satisfied by a file that merely names serializeJsonLd", () => {
    // Guards the exception above: importing or naming the serializer is not
    // enough, the dangerouslySetInnerHTML value itself must be it.
    const offenders: string[] = [];
    for (const file of files) {
      const src = code(readFileSync(file, "utf8"));
      if (!/dangerouslySetInnerHTML/.test(src)) continue;
      const wired = /dangerouslySetInnerHTML\s*=\s*\{\{\s*__html:\s*serializeJsonLd\(/.test(src);
      if (!wired) offenders.push(file.replace(process.cwd(), ""));
    }
    expect(
      offenders,
      "dangerouslySetInnerHTML must be assigned exactly serializeJsonLd(...)"
    ).toEqual([]);
  });

  it("escapes every sequence that could break out of a JSON-LD script tag", async () => {
    const { serializeJsonLd } = await import("./seo/json-ld");
    const hostile = {
      description: '</script><img src=x onerror=alert(1)>',
      other: "a & b < c > d",
      // Valid JSON, but a JavaScript line terminator.
      lines: "before\u2028after\u2029end",
    };
    const out = serializeJsonLd(hostile);
    // The critical property: the literal "</" must not survive anywhere, because
    // that is what terminates a script element.
    expect(out.toLowerCase()).not.toContain("</script");
    expect(out).not.toContain("<");
    expect(out).not.toContain(">");
    expect(out).not.toContain("\u2028");
    expect(out).not.toContain("\u2029");
    // Still valid JSON that round-trips to the original values.
    expect(JSON.parse(out)).toEqual(hostile);
  });

  it("does not build a javascript: or data: URL that a link could point at", () => {
    // A bare "javascript:" literal is not the risk -- a dangerous scheme being
    // concatenated into an href is. The scheme has to appear on a URL that is
    // actually emitted, so both of these are legitimate and must not fail:
    //
    //   const DENY = ["javascript:"];   (a blocklist, and the safety net)
    //   expect(href).not.toMatch(/^javascript:/);   (an assertion)
    //
    // What remains an offence is a dangerous scheme reaching an href/src/src
    // attribute, however it got there.
    const EMIT = /(?:href|src)\s*=\s*\{?\s*[`"'][^`"']*\b(?:javascript|data|vbscript):/i;
    const offenders: string[] = [];
    for (const file of files) {
      const src = code(readFileSync(file, "utf8"));
      if (EMIT.test(src)) offenders.push(file.replace(process.cwd(), ""));
    }
    expect(offenders).toEqual([]);
  });

  it("keeps the dangerous-scheme blocklist in place", async () => {
    // The guard above is pattern-based, so it can be satisfied by simply not
    // mentioning the scheme. Assert the real defence still exists: every
    // dangerous scheme is rejected by the URL allowlist the renderer uses.
    const { safeUrl } = await import("./blog/safe-url");
    for (const scheme of ["javascript", "data", "vbscript", "file", "blob"]) {
      expect(safeUrl(`${scheme}:alert(1)`).ok, scheme).toBe(false);
    }
    // And a genuine allowed URL still passes, so the check is not vacuous.
    expect(safeUrl("https://example.com").ok).toBe(true);
    expect(safeUrl("/pricing").ok).toBe(true);
  });

  it("treats a text sample as text rather than markup", async () => {
    // The stored sample is a plain string column; confirm nothing reinterprets it.
    const { parseHtml } = await import("./crawler/parse");
    const facts = parseHtml(
      `<html><body><script>alert(1)</script><p>hello</p></body></html>`
    );
    expect(facts.textSample).not.toContain("<script");
    expect(facts.textSample).toContain("hello");
  });
});
