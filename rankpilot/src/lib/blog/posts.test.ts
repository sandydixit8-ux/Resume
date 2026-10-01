import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { allPosts, BlogContentError, getPost, isSafeSlug, readingMinutes } from "./posts";

let dir: string;

function write(name: string, contents: string): void {
  writeFileSync(join(dir, name), contents, "utf8");
}

function post(frontmatter: string, body = "Body text."): string {
  return `---\n${frontmatter}\n---\n${body}\n`;
}

const GOOD = "title: Real Title\ndescription: A real description.\ndate: 2026-01-15";

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "rankpilot-blog-"));
  mkdirSync(join(dir, "nested"), { recursive: true });
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("allPosts", () => {
  it("returns [] when the directory does not exist", () => {
    expect(allPosts(join(dir, "missing"))).toEqual([]);
  });

  it("returns [] for an empty directory", () => {
    expect(allPosts(dir)).toEqual([]);
  });

  it("parses title, description, date, author and tags", () => {
    write("a-post.md", post(`${GOOD}\nauthor: Jane Doe\ntags: [seo, content]`));
    const [p] = allPosts(dir);
    expect(p).toMatchObject({
      slug: "a-post",
      title: "Real Title",
      description: "A real description.",
      date: "2026-01-15",
      author: "Jane Doe",
      tags: ["seo", "content"],
      body: "Body text.\n",
    });
  });

  it("strips quotes from quoted scalars", () => {
    write("q.md", post('title: "Quoted: Title"\ndescription: \'Single\'\ndate: 2026-01-15'));
    const [p] = allPosts(dir);
    expect(p.title).toBe("Quoted: Title");
    expect(p.description).toBe("Single");
  });

  it("defaults a missing author rather than failing the build", () => {
    write("noauthor.md", post(GOOD));
    expect(allPosts(dir)[0].author).toBe("RankPilot AI");
  });

  it("accepts a comma-separated tag string as well as an inline list", () => {
    write("csv.md", post(`${GOOD}\ntags: seo, content , ops`));
    expect(allPosts(dir)[0].tags).toEqual(["seo", "content", "ops"]);
  });

  it("ignores comment and blank lines in frontmatter", () => {
    write("c.md", post(`# a comment\n\n${GOOD}`));
    expect(allPosts(dir)[0].title).toBe("Real Title");
  });

  it("sorts newest first and breaks date ties by slug", () => {
    write("b-old.md", post("title: Old\ndescription: d\ndate: 2025-12-31"));
    write("a-new.md", post("title: New\ndescription: d\ndate: 2026-02-01"));
    write("z-tie.md", post("title: Tie\ndescription: d\ndate: 2026-02-01"));
    write("a-tie.md", post("title: Tie2\ndescription: d\ndate: 2026-02-01"));
    expect(allPosts(dir).map((p) => p.slug)).toEqual(["a-new", "a-tie", "z-tie", "b-old"]);
  });

  it("ignores non-markdown files and subdirectories", () => {
    write("real.md", post(GOOD));
    writeFileSync(join(dir, "notes.txt"), "ignored", "utf8");
    writeFileSync(join(dir, "nested", "hidden.md"), post("title: X\ndescription: d\ndate: 2026-01-01"));
    expect(allPosts(dir).map((p) => p.slug)).toEqual(["real"]);
  });

  it("tolerates CRLF line endings", () => {
    writeFileSync(join(dir, "crlf.md"), `---\r\n${GOOD}\r\n---\r\nLine.\r\n`, "utf8");
    const [p] = allPosts(dir);
    expect(p.title).toBe("Real Title");
    expect(p.date).toBe("2026-01-15");
  });

  it("treats a file with no frontmatter as all body", () => {
    writeFileSync(join(dir, "bare.md"), "Just a body, no frontmatter.\n", "utf8");
    expect(() => allPosts(dir)).toThrow(BlogContentError);
  });
});

describe("frontmatter validation", () => {
  it("throws when title is missing", () => {
    write("no-title.md", post("description: d\ndate: 2026-01-15"));
    expect(() => allPosts(dir)).toThrow(/missing required frontmatter field "title"/);
  });

  it("throws when description is missing", () => {
    write("no-desc.md", post("title: T\ndate: 2026-01-15"));
    expect(() => allPosts(dir)).toThrow(/missing required frontmatter field "description"/);
  });

  it("throws when date is missing rather than inventing 1970-01-01", () => {
    write("no-date.md", post("title: T\ndescription: d"));
    expect(() => allPosts(dir)).toThrow(/missing required frontmatter field "date"/);
  });

  it("throws on a malformed date", () => {
    write("bad-date.md", post("title: T\ndescription: d\ndate: 15/01/2026"));
    expect(() => allPosts(dir)).toThrow(/not a real YYYY-MM-DD date/);
  });

  it("throws on an impossible calendar date", () => {
    write("feb31.md", post("title: T\ndescription: d\ndate: 2026-02-31"));
    expect(() => allPosts(dir)).toThrow(/not a real YYYY-MM-DD date/);
  });

  it("names the offending file in the error", () => {
    write("broken.md", post("description: d\ndate: 2026-01-15"));
    expect(() => allPosts(dir)).toThrow(/content\/blog\/broken\.md/);
  });

  it("throws on a filename that is not a valid slug instead of skipping it", () => {
    // Such a file can never be addressed by /blog/<slug>, so loading it would
    // mean the post silently disappears from the site.
    writeFileSync(join(dir, "_hostile-probe.md"), post(GOOD), "utf8");
    expect(() => allPosts(dir)).toThrow(/cannot be published/);
  });

  it("suggests a corrected slug in the error", () => {
    writeFileSync(join(dir, "My Post.md"), post(GOOD), "utf8");
    expect(() => allPosts(dir)).toThrow(/my-post/);
  });
});

describe("getPost", () => {
  beforeEach(() => {
    write("hello-world.md", post(GOOD));
  });

  it("loads an existing post", () => {
    expect(getPost("hello-world", dir)?.title).toBe("Real Title");
  });

  it("returns null for an unknown slug", () => {
    expect(getPost("nope", dir)).toBeNull();
  });

  for (const bad of ["../secrets", "..%2Fsecrets", "a/b", "a\\b", "UPPER", "", ".", "..", "a--b", "-a"]) {
    it(`refuses the traversal/unsafe slug ${JSON.stringify(bad)}`, () => {
      expect(getPost(bad, dir)).toBeNull();
    });
  }
});

describe("isSafeSlug", () => {
  it("accepts lowercase hyphenated slugs", () => {
    for (const ok of ["a", "a-post", "seo-1-2-3", "abc123"]) {
      expect(isSafeSlug(ok)).toBe(true);
    }
  });

  it("rejects anything else", () => {
    for (const bad of ["", "A", "a b", "a/b", "../a", "a_b", "a--b", "-a", "a-", "café"]) {
      expect(isSafeSlug(bad)).toBe(false);
    }
  });
});

describe("readingMinutes", () => {
  it("is never below 1", () => {
    expect(readingMinutes("")).toBe(1);
    expect(readingMinutes("one two")).toBe(1);
  });

  it("rounds at roughly 220 words per minute", () => {
    expect(readingMinutes(Array.from({ length: 440 }, () => "word").join(" "))).toBe(2);
  });
});
