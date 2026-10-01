import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Blog posts, authored as Markdown files under content/blog and read at build
 * time.
 *
 * Files rather than the `content` table on purpose. That table is tenant-scoped
 * (`tenant_id NOT NULL`) and holds per-customer drafts produced by the Content
 * Studio; a public marketing post is the opposite -- site-wide, reviewed in git,
 * and immutable once published. Reusing the table would have meant inventing an
 * "anonymous tenant" and quietly mixing unpublished AI drafts into a public
 * sitemap.
 *
 * Consequences worth stating: posts are deploy-time content, so publishing
 * requires a deploy, and there is no draft/preview state. Both are fine for a
 * marketing blog and wrong for a CMS, which is what the CMS integration is for.
 */

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  /** ISO date (YYYY-MM-DD), used for sorting and the <time> element. */
  date: string;
  author: string;
  tags: string[];
  body: string;
}

const DEFAULT_POSTS_DIR = join(process.cwd(), "content", "blog");
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

/** Slugs become URL segments and file names, so the allowed set is narrow. */
const SAFE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Directory override, so tests can point at a fixture instead of the real
 * content/blog. Not env-driven: posts are build-time content, and letting an
 * operator repoint the blog at an arbitrary directory at runtime would be a
 * footgun with no upside.
 */
function postsDir(override?: string): string {
  return override ?? DEFAULT_POSTS_DIR;
}

function unquote(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2)
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/**
 * Minimal YAML frontmatter: flat `key: value` pairs plus one inline list.
 * Anything richer is not supported on purpose, so an author who reaches for it
 * gets a visible error rather than a silently ignored field.
 */
function parseFrontmatter(raw: string): { data: Record<string, string | string[]>; body: string } {
  const match = FRONTMATTER.exec(raw);
  if (!match) return { data: {}, body: raw };

  const data: Record<string, string | string[]> = {};
  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const sep = line.indexOf(":");
    if (sep === -1) continue;
    const key = line.slice(0, sep).trim();
    const value = line.slice(sep + 1).trim();
    if (value.startsWith("[") && value.endsWith("]")) {
      data[key] = value
        .slice(1, -1)
        .split(",")
        .map((v) => unquote(v))
        .filter(Boolean);
    } else {
      data[key] = unquote(value);
    }
  }
  return { data, body: raw.slice(match[0].length) };
}

const str = (v: string | string[] | undefined, fallback = ""): string =>
  typeof v === "string" ? v : fallback;

const list = (v: string | string[] | undefined): string[] => {
  if (Array.isArray(v)) return v;
  if (typeof v === "string" && v.trim()) return v.split(",").map((s) => s.trim()).filter(Boolean);
  return [];
};

/** True when a frontmatter date is a real YYYY-MM-DD calendar date. */
function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export class BlogContentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BlogContentError";
  }
}

function requireString(data: Record<string, string | string[]>, key: string, slug: string): string {
  const value = str(data[key]);
  if (!value) {
    throw new BlogContentError(
      `content/blog/${slug}.md is missing required frontmatter field "${key}". ` +
        `Every post needs title, description and date.`,
    );
  }
  return value;
}

function loadPost(slug: string, dir: string): BlogPost | null {
  // Defence in depth against traversal, even though the slug is rejected earlier.
  if (!SAFE_SLUG.test(slug)) return null;
  const file = join(dir, `${slug}.md`);
  if (!file.startsWith(dir)) return null;
  if (!existsSync(file)) return null;
  const { data, body } = parseFrontmatter(
    readFileSync(/*turbopackIgnore: true*/ file, "utf8"),
  );
  const date = requireString(data, "date", slug);
  if (!validDate(date)) {
    throw new BlogContentError(
      `content/blog/${slug}.md has frontmatter date "${date}", which is not a real YYYY-MM-DD date.`,
    );
  }
  return {
    slug,
    title: requireString(data, "title", slug),
    description: requireString(data, "description", slug),
    date,
    author: str(data.author, "RankPilot AI"),
    tags: list(data.tags),
    body,
  };
}

/**
 * All posts, newest first.
 *
 * Throws on malformed frontmatter rather than skipping the file. A post that
 * silently disappears from a marketing page is worse than a failed deploy: the
 * build is the only moment the error can still be fixed.
 */
export function allPosts(dirOverride?: string): BlogPost[] {
  const dir = postsDir(dirOverride);
  // turbopackIgnore: these reads are build-time only. /blog/[slug] sets
  // dynamicParams = false, so every post is prerendered and nothing here runs
  // during a request. Without the opt-out Turbopack cannot see through the
  // postsDir() indirection plus the test-only dirOverride, assumes the path is
  // fully dynamic, and traces the entire repository into the server output --
  // which would ship all source files to the server bundle. The traced files
  // would never be read, so the cost is pure bloat.
  if (!existsSync(/*turbopackIgnore: true*/ dir)) return [];
  const posts: BlogPost[] = [];
  for (const name of readdirSync(/*turbopackIgnore: true*/ dir)) {
    if (!name.endsWith(".md")) continue;
    const slug = name.slice(0, -3);
    // Same reasoning as the frontmatter checks: a file the slug rules cannot
    // address would 404 forever, and quietly vanishing from the index is not an
    // acceptable way to learn that. A leading underscore or a capital is a
    // near-miss typo, not an intentional exclusion.
    if (!SAFE_SLUG.test(slug)) {
      throw new BlogContentError(
        `content/blog/${name} cannot be published: "${slug}" is not a valid slug. ` +
          `Use lowercase letters, digits and single hyphens only (for example ${slug.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "post-slug"}).`,
      );
    }
    const post = loadPost(slug, dir);
    if (post) posts.push(post);
  }
  return posts.sort((a, b) =>
    a.date < b.date ? 1 : a.date > b.date ? -1 : a.slug.localeCompare(b.slug),
  );
}

export function getPost(slug: string, dirOverride?: string): BlogPost | null {
  return loadPost(slug, postsDir(dirOverride));
}

/** Slug validation, exported so the route can reject bad input before lookup. */
export function isSafeSlug(slug: string): boolean {
  return SAFE_SLUG.test(slug);
}

/** Rough reading time, for the byline. */
export function readingMinutes(body: string): number {
  const words = body.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}
