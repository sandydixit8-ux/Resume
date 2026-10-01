import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { allPosts } from "./posts";

const BLOG_DIR = join(process.cwd(), "content", "blog");
const SITEMAP = readFileSync(join(process.cwd(), "src", "app", "sitemap.ts"), "utf8");
const INDEX_PAGE = readFileSync(join(process.cwd(), "src", "app", "blog", "page.tsx"), "utf8");
const POST_PAGE = readFileSync(
  join(process.cwd(), "src", "app", "blog", "[slug]", "page.tsx"),
  "utf8",
);

/**
 * These guard the real content directory, not a fixture. A post with broken
 * frontmatter or a missing canonical would otherwise only surface as a subtly
 * wrong page in production.
 */
describe("shipped blog content", () => {
  it("has at least one post", () => {
    expect(readdirSync(BLOG_DIR).filter((f) => f.endsWith(".md")).length).toBeGreaterThan(0);
  });

  it("loads every shipped post without throwing", () => {
    expect(() => allPosts()).not.toThrow();
  });

  it("gives every post a title, description and a non-epoch date", () => {
    for (const post of allPosts()) {
      expect(post.title.length, `${post.slug} title`).toBeGreaterThan(0);
      expect(post.description.length, `${post.slug} description`).toBeGreaterThan(0);
      expect(post.date, `${post.slug} date`).not.toBe("1970-01-01");
    }
  });

  it("keeps descriptions a sane length for search snippets", () => {
    for (const post of allPosts()) {
      expect(post.description.length, `${post.slug} description`).toBeLessThanOrEqual(200);
    }
  });

  it("uses unique slugs", () => {
    const slugs = allPosts().map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("gives every post a non-empty body that parses to blocks", () => {
    for (const post of allPosts()) {
      expect(post.body.trim().length, `${post.slug} body`).toBeGreaterThan(0);
    }
  });
});

describe("blog route wiring", () => {
  it("lists blog posts in the sitemap", () => {
    expect(SITEMAP).toContain("/blog/${post.slug}");
    expect(SITEMAP).toContain("allPosts");
  });

  it("has a canonical for the blog index", () => {
    expect(INDEX_PAGE).toContain('canonical: "/blog"');
  });

  it("has a per-post canonical and Article structured data", () => {
    expect(POST_PAGE).toContain("canonical: `/blog/${post.slug}`");
    expect(POST_PAGE).toContain("articleJsonLd");
  });

  it("prerenders every post at build time", () => {
    expect(POST_PAGE).toContain("generateStaticParams");
  });
});
