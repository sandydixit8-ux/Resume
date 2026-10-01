import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth/get-session";
import { getWebsite } from "@/lib/websites/repo";
import { all, row } from "@/lib/db/db";
import { Badge, Card } from "@/components/ui";

export const dynamic = "force-dynamic";

function safeJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export default async function PageDetailPage({
  params,
}: {
  params: Promise<{ id: string; pageId: string }>;
}) {
  const session = (await getSession())!;
  const { id, pageId } = await params;
  const website = getWebsite(session.org.id, id);
  if (!website) notFound();

  const page = row<{
    id: string;
    url: string;
    status_code: number | null;
    redirect_url: string | null;
    content_type: string | null;
    depth: number;
    title: string | null;
    title_len: number;
    meta_description: string | null;
    meta_desc_len: number;
    h1: string | null;
    headings: string;
    canonical: string | null;
    robots_meta: string | null;
    is_indexable: number;
    word_count: number;
    lang: string | null;
    internal_link_count: number;
    external_link_count: number;
    inbound_link_count: number;
    image_count: number;
    images_missing_alt: number;
    html_bytes: number;
    ttfb_ms: number;
    has_structured_data: number;
    structured_types: string;
    og_title: string | null;
    og_description: string | null;
    fetched_at: string;
  }>("SELECT * FROM pages WHERE id = ? AND website_id = ?", pageId, id);
  if (!page) notFound();

  const issues = all<{
    id: string;
    code: string;
    title: string;
    severity: string;
    category: string;
    status: string;
    recommendation: string;
  }>(
    "SELECT id, code, title, severity, category, status, recommendation FROM seo_issues WHERE page_id = ? ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END",
    pageId
  );

  const headings = safeJson<Array<{ level: number; text: string }>>(page.headings, []);
  const structuredTypes = safeJson<string[]>(page.structured_types, []);

  const facts: Array<[string, string]> = [
    ["Status", String(page.status_code ?? "?")],
    ["Indexable", page.is_indexable ? "yes" : "no"],
    ["Robots meta", page.robots_meta ?? "none"],
    ["Depth", String(page.depth)],
    ["Language", page.lang ?? "not set"],
    ["Word count", String(page.word_count)],
    ["Internal links out", String(page.internal_link_count)],
    ["Inbound links", String(page.inbound_link_count)],
    ["External links", String(page.external_link_count)],
    ["Images (missing alt)", `${page.image_count} (${page.images_missing_alt})`],
    ["HTML size", `${(page.html_bytes / 1024).toFixed(1)} KB`],
    ["TTFB", page.ttfb_ms ? `${page.ttfb_ms} ms` : "Data unavailable"],
    ["Structured data", structuredTypes.length ? structuredTypes.join(", ") : "none"],
    ["Canonical", page.canonical ?? "none"],
    ["Fetched", new Date(page.fetched_at).toLocaleString()],
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-ink-400">
            <Link href={`/app/websites/${id}/pages`} className="hover:text-brand-600">Pages</Link> / detail
          </div>
          <a href={page.url} target="_blank" rel="noreferrer noopener" className="block break-all text-base font-semibold text-brand-700 hover:underline">
            {page.url}
          </a>
        </div>
        <div className="flex gap-2">
          <Badge tone={page.status_code === 200 ? "resolved" : "critical"}>HTTP {page.status_code ?? "?"}</Badge>
          <Badge tone={page.is_indexable ? "resolved" : "ignored"}>
            {page.is_indexable ? "indexable" : "noindex"}
          </Badge>
          <Badge tone={issues.some((i) => i.status === "new" && i.severity === "critical") ? "critical" : "low"}>
            {issues.filter((i) => i.status === "new").length} open issues
          </Badge>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-1">
          <div className="text-sm font-semibold uppercase tracking-wide text-ink-400">On-page facts</div>
          <dl className="mt-3 divide-y divide-ink-100 text-sm">
            {facts.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 py-2">
                <dt className="text-ink-500">{k}</dt>
                <dd className="truncate text-right font-medium text-ink-800">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          <Card className="p-5">
            <div className="text-sm font-semibold uppercase tracking-wide text-ink-400">Search appearance</div>
            <div className="mt-3 space-y-3 text-sm">
              <div>
                <div className="text-xs text-ink-400">Title ({page.title_len} chars)</div>
                <div className="font-medium text-ink-900">{page.title || <span className="text-red-500">missing</span>}</div>
              </div>
              <div>
                <div className="text-xs text-ink-400">Meta description ({page.meta_desc_len} chars)</div>
                <div className="text-ink-700">{page.meta_description || <span className="text-red-500">missing</span>}</div>
              </div>
              <div>
                <div className="text-xs text-ink-400">H1</div>
                <div className="text-ink-700">{page.h1 || <span className="text-red-500">missing</span>}</div>
              </div>
              <div>
                <div className="text-xs text-ink-400">Open Graph title</div>
                <div className="text-ink-700">{page.og_title || "missing"}</div>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <div className="text-sm font-semibold uppercase tracking-wide text-ink-400">
              Headings ({headings.length})
            </div>
            {headings.length === 0 ? (
              <p className="mt-2 text-sm text-ink-500">No headings found.</p>
            ) : (
              <ul className="mt-2 space-y-1">
                {headings.map((h, i) => (
                  <li key={`${h.level}-${i}`} className="flex gap-2 text-sm text-ink-700">
                    <span className="font-mono text-xs text-ink-400">H{h.level}</span>
                    <span>{h.text}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-5">
            <div className="text-sm font-semibold uppercase tracking-wide text-ink-400">
              Issues on this page ({issues.length})
            </div>
            {issues.length === 0 ? (
              <p className="mt-2 text-sm text-ink-500">No issues recorded for this page.</p>
            ) : (
              <ul className="mt-3 divide-y divide-ink-100">
                {issues.map((i) => (
                  <li key={i.id} className="py-3">
                    <Link href={`/app/websites/${id}/issues/${i.id}`} className="flex items-start justify-between gap-3 hover:text-brand-700">
                      <span className="min-w-0">
                        <span className="mr-2 font-mono text-xs text-ink-400">{i.code}</span>
                        <span className="text-sm font-medium text-ink-900">{i.title}</span>
                        <span className="mt-1 block text-xs text-ink-500">{i.recommendation}</span>
                      </span>
                      <span className="flex shrink-0 gap-1.5">
                        <Badge tone={i.severity}>{i.severity}</Badge>
                        <Badge tone={i.status === "resolved" ? "resolved" : "low"}>{i.status}</Badge>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
