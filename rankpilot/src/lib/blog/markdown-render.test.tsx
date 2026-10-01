import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { parseMarkdown } from "./markdown";
import { renderMarkdown } from "./markdown-render";

/**
 * End-to-end checks on the rendered HTML.
 *
 * The AST tests prove the parser is correct; these prove the output is safe.
 * They are the tests that would actually catch a regression in the renderer,
 * which is the component that decides what becomes a real attribute.
 */

const render = (src: string): string =>
  renderToStaticMarkup(<>{renderMarkdown(parseMarkdown(src))}</>);

describe("rendering safety", () => {
  it("never emits a javascript: href", () => {
    // A hostile post is ordinary author input as far as the renderer is
    // concerned, so this is the exact shape a real post would take.
    for (const src of [
      "[click](javascript:alert(1))",
      "[click](JaVaScRiPt:alert(1))",
      "[click](java\tscript:alert(1))",
      "[click](data:text/html,<script>alert(1)</script>)",
      "[click](vbscript:msgbox(1))",
    ]) {
      const html = render(src);
      expect(html.toLowerCase(), src).not.toContain("javascript:");
      expect(html.toLowerCase(), src).not.toContain("data:text/html");
      expect(html.toLowerCase(), src).not.toContain("vbscript:");
    }
  });

  it("keeps the link text visible when the URL is refused", () => {
    // Refusing silently would hide a content bug from whoever wrote the post.
    expect(render("[click me](javascript:alert(1))")).toContain("click me");
  });

  it("emits a real href for a safe link", () => {
    // Note the trailing slash: safeUrl normalises through `new URL`, so a
    // bare origin becomes "https://example.com/". Semantically the same URL.
    expect(render("[docs](https://example.com)")).toContain('href="https://example.com/"');
    expect(render("[docs](https://example.com/guide)")).toContain('href="https://example.com/guide"');
    expect(render("[pricing](/pricing)")).toContain('href="/pricing"');
  });

  it("marks external links noopener and nofollow", () => {
    const html = render("[ext](https://example.com)");
    expect(html).toContain('rel="noopener noreferrer nofollow"');
    expect(html).toContain('target="_blank"');
  });

  it("does not add target=_blank to internal links", () => {
    expect(render("[internal](/pricing)")).not.toContain("target=");
  });

  it("escapes raw HTML instead of rendering it", () => {
    // React escaping is the protection. If this ever stops being true, the
    // xss-guard is the backstop and this test is the reason to notice.
    const html = render("<script>alert(1)</script>");
    expect(html).not.toContain("<script");
    expect(html).toContain("&lt;script&gt;");
  });

  it("escapes HTML smuggled through a link label", () => {
    const html = render("[<img src=x onerror=alert(1)>](/x)");
    // The point is that no element was created, not that the characters are
    // absent: they survive as escaped text, which is correct and harmless.
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });

  it("refuses an unsafe image src but keeps the alt text", () => {
    const html = render("![a cat](javascript:alert(1))");
    expect(html.toLowerCase()).not.toContain("javascript:");
    expect(html).toContain("a cat");
  });

  it("renders code block contents as text, never as markup", () => {
    const html = render("```html\n<script>alert(1)</script>\n```");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("produces a stable set of tags for a full document", () => {
    const html = render(
      [
        "# Title",
        "",
        "Intro with **bold** and a [link](/pricing).",
        "",
        "- one",
        "- two",
        "",
        "1. first",
        "2. second",
        "",
        "> a quote",
        "",
        "---",
        "",
        "```ts",
        "const x = 1;",
        "```",
      ].join("\n")
    );
    expect(html).toContain("<h1");
    expect(html).toMatch(/<strong[^>]*>bold<\/strong>/);
    expect(html).toMatch(/<a[^>]*href="\/pricing"/);
    expect(html).toContain("<ul");
    expect(html).toContain("<ol");
    expect(html).toContain("<blockquote");
    expect(html).toContain("<hr");
    expect(html).toContain("<pre");
  });

  it("renders an empty document without throwing", () => {
    expect(render("")).toBe("");
  });
});
