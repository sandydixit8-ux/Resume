import Link from "next/link";
import { getSession } from "@/lib/auth/get-session";
import { getWebsite } from "@/lib/websites/repo";
import { all, row } from "@/lib/db/db";
import { Badge, Card, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function PagesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = (await getSession())!;
  const { id } = await params;
  const sp = await searchParams;
  const website = getWebsite(session.org.id, id);
  if (!website) return null;

  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const limit = 50;
  const offset = (page - 1) * limit;
  const total = row<{ n: number }>("SELECT COUNT(*) AS n FROM pages WHERE website_id = ?", id)?.n ?? 0;

  const items = all<{
    id: string;
    url: string;
    status_code: number | null;
    is_indexable: number;
    title: string | null;
    title_len: number;
    meta_desc_len: number;
    word_count: number;
    inbound_link_count: number;
    images_missing_alt: number;
    ttfb_ms: number;
  }>(
    `SELECT id, url, status_code, is_indexable, title, title_len, meta_desc_len, word_count,
            inbound_link_count, images_missing_alt, ttfb_ms
     FROM pages WHERE website_id = ? ORDER BY depth ASC, url ASC LIMIT ? OFFSET ?`,
    id,
    limit,
    offset
  );

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm text-ink-500">
        <span>{total} pages discovered</span>
        <span>Page {page} of {totalPages}</span>
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="No pages yet"
          description="Run a crawl and every URL we discover will show up here with its on-page facts."
        />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-400">
              <tr>
                <th className="px-4 py-3 font-medium">URL</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Index</th>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Meta</th>
                <th className="px-4 py-3 font-medium">Words</th>
                <th className="px-4 py-3 font-medium">Inbound</th>
                <th className="px-4 py-3 font-medium">Alt missing</th>
                <th className="px-4 py-3 font-medium">TTFB</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {items.map((p) => (
                <tr key={p.id} className="hover:bg-ink-50/60">
                  <td className="max-w-xs truncate px-4 py-2.5">
                    <Link href={`/app/websites/${id}/pages/${p.id}`} className="text-brand-700 hover:underline">
                      {p.url.replace(/^https?:\/\//, "")}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge tone={p.status_code === 200 ? "resolved" : p.status_code ? "critical" : "low"}>
                      {p.status_code ?? "?"}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge tone={p.is_indexable ? "resolved" : "ignored"}>{p.is_indexable ? "index" : "noindex"}</Badge>
                  </td>
                  <td className="max-w-[16rem] truncate px-4 py-2.5 text-ink-700">
                    {p.title || <span className="text-red-500">missing</span>}
                    <span className={`ml-1.5 text-xs ${p.title_len && (p.title_len < 30 || p.title_len > 60) ? "text-amber-600" : "text-ink-300"}`}>
                      {p.title_len || 0}
                    </span>
                  </td>
                  <td className={`px-4 py-2.5 ${p.meta_desc_len < 70 || p.meta_desc_len > 165 ? "text-amber-600" : "text-ink-500"}`}>
                    {p.meta_desc_len || 0}
                  </td>
                  <td className="px-4 py-2.5 text-ink-700">{p.word_count}</td>
                  <td className="px-4 py-2.5 text-ink-700">{p.inbound_link_count}</td>
                  <td className={`px-4 py-2.5 ${p.images_missing_alt > 0 ? "text-amber-600" : "text-ink-500"}`}>
                    {p.images_missing_alt}
                  </td>
                  <td className={`px-4 py-2.5 ${p.ttfb_ms > 800 ? "text-amber-600" : "text-ink-500"}`}>
                    {p.ttfb_ms ? `${p.ttfb_ms}ms` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {totalPages > 1 ? (
        <div className="flex justify-between text-sm">
          <span className="text-ink-500">{total} pages</span>
          <div className="flex gap-2">
            {page > 1 ? <Link className="btn-ghost" href={`/app/websites/${id}/pages?page=${page - 1}`}>← Previous</Link> : null}
            {page < totalPages ? <Link className="btn-ghost" href={`/app/websites/${id}/pages?page=${page + 1}`}>Next →</Link> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
