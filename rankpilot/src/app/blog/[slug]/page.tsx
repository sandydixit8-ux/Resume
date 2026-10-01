import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { allPosts, getPost, isSafeSlug, readingMinutes } from "@/lib/blog/posts";
import { parseMarkdown } from "@/lib/blog/markdown";
import { renderMarkdown } from "@/lib/blog/markdown-render";
import { articleJsonLd, serializeJsonLd } from "@/lib/seo/json-ld";

interface Props {
  params: Promise<{ slug: string }>;
}

/**
 * Every post is prerendered at build time. Content is a fixed set of files, so
 * there is no reason to serve these dynamically.
 */
export function generateStaticParams(): Array<{ slug: string }> {
  return allPosts().map((post) => ({ slug: post.slug }));
}

/**
 * Only the slugs from generateStaticParams exist. Without this, Next renders
 * unknown slugs on demand at request time, which would make post loading a
 * runtime filesystem read instead of a build-time one -- and silently re-open
 * that hole to any request that guessed a URL.
 */
export const dynamicParams = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (!isSafeSlug(slug)) return {};
  const post = getPost(slug);
  if (!post) return {};

  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: `/blog/${post.slug}` },
    robots: { index: true, follow: true },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.description,
      publishedTime: post.date,
      authors: [post.author],
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  if (!isSafeSlug(slug)) notFound();

  const post = getPost(slug);
  if (!post) notFound();

  const blocks = parseMarkdown(post.body);

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16">
      <script
        type="application/ld+json"
        // Safe: schema.org metadata built from our own frontmatter, escaped by
        // serializeJsonLd. This is the one value the repo's xss-guard allows.
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(
            articleJsonLd({
              title: post.title,
              description: post.description,
              date: post.date,
              author: post.author,
              slug: post.slug,
            }),
          ),
        }}
      />

      <article>
        <header className="mb-10">
          <p className="mb-4 text-sm">
            <Link href="/blog" className="text-brand-700 underline-offset-4 hover:underline">
              ← All guides
            </Link>
          </p>
          <h1 className="text-4xl font-bold tracking-tight text-ink-900">{post.title}</h1>
          <p className="mt-4 text-sm text-ink-400">
            <time dateTime={post.date}>{post.date}</time>
            {" · "}
            {post.author}
            {" · "}
            {readingMinutes(post.body)} min read
          </p>
          {post.tags.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <li
                  key={tag}
                  className="rounded-full bg-ink-100 px-3 py-1 text-xs text-ink-600"
                >
                  {tag}
                </li>
              ))}
            </ul>
          )}
        </header>

        {renderMarkdown(blocks)}
      </article>
    </main>
  );
}
