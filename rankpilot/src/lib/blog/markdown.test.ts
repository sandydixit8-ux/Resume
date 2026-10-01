import { describe, expect, it } from "vitest";
import { parseInline, parseMarkdown } from "./markdown";
import { safeUrl, isSafeUrl } from "./safe-url";

const kinds = (nodes: ReturnType<typeof parseInline>) => nodes.map((n) => n.kind);
const blockKinds = (src: string) => parseMarkdown(src).map((b) => b.kind);

describe("safeUrl", () => {
  it("allows ordinary web and mail links", () => {
    for (const u of [
      "https://example.com",
      "http://example.com",
      "mailto:hi@example.com",
      "/pricing",
      "/blog/post#section",
      "#anchor",
    ]) {
      expect(safeUrl(u).ok, u).toBe(true);
    }
  });

  it("refuses javascript: and its obfuscated spellings", () => {
    // The reason this module exists. A refused link renders as inert text.
    for (const u of [
      "javascript:alert(1)",
      "JavaScript:alert(1)",
      "  javascript:alert(1)  ",
      "java\tscript:alert(1)",
      "java\nscript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "vbscript:msgbox(1)",
      "file:///etc/passwd",
      "blob:https://evil.example/uuid",
    ]) {
      expect(safeUrl(u).ok, u).toBe(false);
    }
  });

  it("refuses protocol-relative URLs, which inherit the scheme silently", () => {
    expect(safeUrl("//evil.example").ok).toBe(false);
    expect(safeUrl("\\\\evil.example").ok).toBe(false);
  });

  it("refuses nonsense rather than guessing", () => {
    for (const u of ["", "   ", "not a url", "http://", "://missing-scheme"]) {
      expect(safeUrl(u).ok, u).toBe(false);
    }
  });

  it("exposes a boolean form", () => {
    expect(isSafeUrl("https://example.com")).toBe(true);
    expect(isSafeUrl("javascript:alert(1)")).toBe(false);
  });
});

describe("block parsing", () => {
  it("parses headings at every level", () => {
    expect(blockKinds("# One\n## Two\n### Three\n#### Four\n##### Five\n###### Six")).toEqual([
      "heading",
      "heading",
      "heading",
      "heading",
      "heading",
      "heading",
    ]);
    const blocks = parseMarkdown("### Three");
    expect(blocks[0]).toMatchObject({ kind: "heading", level: 3 });
  });

  it("never produces a heading level outside 1-6", () => {
    const blocks = parseMarkdown("####### Seven");
    expect(blocks[0].kind).not.toBe("heading");
  });

  it("parses fenced code with and without a language", () => {
    const withLang = parseMarkdown("```ts\nconst a = 1;\n```");
    expect(withLang[0]).toEqual({ kind: "code", lang: "ts", value: "const a = 1;" });

    const bare = parseMarkdown("```\nplain\n```");
    expect(bare[0]).toMatchObject({ kind: "code", lang: "", value: "plain" });
  });

  it("leaves markdown inside a code fence alone", () => {
    // The single most important property of fenced code: its contents are not
    // interpreted as any other block or inline construct.
    const blocks = parseMarkdown("```\n# not a heading\n**not bold**\n```");
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ kind: "code" });
    expect((blocks[0] as { value: string }).value).toBe("# not a heading\n**not bold**");
  });

  it("does not hang on an unclosed fence", () => {
    const blocks = parseMarkdown("```\nstill open\nmore");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].kind).toBe("code");
  });

  it("supports tilde fences", () => {
    const blocks = parseMarkdown("~~~\ntilde\n~~~");
    expect(blocks[0]).toMatchObject({ kind: "code", value: "tilde" });
  });

  it("parses blockquotes including nested blocks", () => {
    const blocks = parseMarkdown("> quoted text\n> \n> ## heading inside");
    expect(blocks[0].kind).toBe("blockquote");
    const inner = (blocks[0] as { children: { kind: string }[] }).children;
    expect(inner.map((c) => c.kind)).toEqual(["paragraph", "heading"]);
  });

  it("parses unordered and ordered lists", () => {
    const ul = parseMarkdown("- one\n- two");
    expect(ul[0]).toMatchObject({ kind: "list", ordered: false });
    expect((ul[0] as { items: unknown[] }).items).toHaveLength(2);

    const ol = parseMarkdown("1. first\n2. second");
    expect(ol[0]).toMatchObject({ kind: "list", ordered: true, start: 1 });
  });

  it("honours a non-1 ordered list start", () => {
    const ol = parseMarkdown("3. third\n4. fourth");
    expect(ol[0]).toMatchObject({ kind: "list", start: 3 });
  });

  it("separates two lists that follow each other", () => {
    const blocks = parseMarkdown("- a\n- b\n\n1. one\n2. two");
    expect(blocks.map((b) => b.kind)).toEqual(["list", "list"]);
  });

  it("parses thematic breaks in all three forms", () => {
    for (const src of ["---", "***", "___", "- - -"]) {
      expect(blockKinds(src)).toContain("hr");
    }
  });

  it("does not treat a horizontal rule as a list", () => {
    // "- - -" is a thematic break in CommonMark, not three empty bullets.
    expect(blockKinds("- - -")).toEqual(["hr"]);
  });

  it("stops a paragraph at a heading", () => {
    const blocks = parseMarkdown("text here\n# heading");
    expect(blocks.map((b) => b.kind)).toEqual(["paragraph", "heading"]);
  });

  it("keeps consecutive text lines as one paragraph", () => {
    const blocks = parseMarkdown("line one\nline two");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].kind).toBe("paragraph");
  });

  it("normalises CRLF and tabs", () => {
    const blocks = parseMarkdown("a\r\nb\rc");
    expect(blocks).toHaveLength(1);
  });

  it("returns nothing for empty or blank input", () => {
    expect(parseMarkdown("")).toEqual([]);
    expect(parseMarkdown("\n\n   \n")).toEqual([]);
  });
});

describe("inline parsing", () => {
  it("parses code, strong, em and strike", () => {
    expect(kinds(parseInline("plain `code` here"))).toEqual(["text", "code", "text"]);
    expect(kinds(parseInline("**bold**"))).toEqual(["strong"]);
    expect(kinds(parseInline("*italic*"))).toEqual(["em"]);
    expect(kinds(parseInline("_italic_"))).toEqual(["em"]);
    expect(kinds(parseInline("~~gone~~"))).toEqual(["strike"]);
  });

  it("does not treat asterisks inside a code span as emphasis", () => {
    // Emphasis must lose to code spans, or documentation breaks.
    const nodes = parseInline("`**not bold**`");
    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toEqual({ kind: "code", value: "**not bold**" });
  });

  it("leaves unbalanced emphasis as literal text", () => {
    expect(kinds(parseInline("2 * 3 * 4"))).toEqual(["text"]);
    expect(kinds(parseInline("a ** b"))).toEqual(["text"]);
  });

  it("parses links and images, keeping the URL verbatim", () => {
    // Verbatim on purpose: safeUrl is the policy layer, and mixing the two
    // would make the parser untestable on its own.
    const link = parseInline("[text](https://example.com)");
    expect(link[0]).toMatchObject({ kind: "link", href: "https://example.com" });

    const img = parseInline("![alt text](/img.png)");
    expect(img[0]).toMatchObject({ kind: "image", src: "/img.png", alt: "alt text" });
  });

  it("captures a link title", () => {
    expect(parseInline('[t](https://e.com "Title")')[0]).toMatchObject({ title: "Title" });
  });

  it("nests inline constructs inside a link", () => {
    const link = parseInline("[**bold link**](https://e.com)")[0];
    expect(link.kind).toBe("link");
    if (link.kind === "link") {
      expect(link.children[0].kind).toBe("strong");
    }
  });

  it("leaves raw HTML as plain text", () => {
    // No HTML passthrough by design; the repository forbids injecting markup.
    const nodes = parseInline("<script>alert(1)</script>");
    expect(nodes.every((n) => n.kind === "text")).toBe(true);
    expect(nodes.map((n) => (n.kind === "text" ? n.value : "")).join("")).toContain(
      "<script>alert(1)</script>"
    );
  });

  it("parses mixed inline content in order", () => {
    const nodes = parseInline("a **b** c `d` e");
    expect(kinds(nodes)).toEqual(["text", "strong", "text", "code", "text"]);
  });
});
