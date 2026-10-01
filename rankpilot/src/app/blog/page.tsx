import type { Metadata } from "next";
import Link from "next/link";
import { allPosts, readingMinutes } from "@/lib/blog/posts";

export const metadata: Metadata = {
  title: "SEO Guides — RankPilot",
  description:
    "Practical writing on technical SEO, site audits and the fixes that actually change traffic.",
  alternates: { canonical: "/blog" },
  robots: { index: true, follow: true },
};

export default function BlogIndexPage() {
  const posts = allPosts();

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16">
      <header className="mb-12">
        <h1 className="text-4xl font-bold tracking-tight text-ink-900">SEO Guides</h1>
        <p className="mt-3 text-lg text-ink-500">
          Practical notes on audits, technical SEO and the fixes that move traffic.
        </p>
      </header>

      {posts.length === 0 ? (
        <p className="text-ink-500">No posts published yet.</p>
      ) : (
        <ul className="space-y-8">
          {posts.map((post) => (
            <li key={post.slug}>
              <article>
                <h2 className="text-2xl font-semibold tracking-tight text-ink-900">
                  <Link
                    href={`/blog/${post.slug}`}
                    className="text-brand-700 underline-offset-4 hover:underline"
                  >
                    {post.title}
                  </Link>
                </h2>
                <p className="mt-1 text-sm text-ink-400">
                  <time dateTime={post.date}>{post.date}</time>
                  {" · "}
                  {readingMinutes(post.body)} min read
                </p>
                <p className="mt-2 leading-7 text-ink-700">{post.description}</p>
              </article>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
