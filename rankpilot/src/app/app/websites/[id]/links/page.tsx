import { getSession } from "@/lib/auth/get-session";
import { getWebsite } from "@/lib/websites/repo";
import { all, row } from "@/lib/db/db";
import { Badge, Card, EmptyState } from "@/components/ui";
import { GenerateLinksButton } from "@/components/link-actions";

export const dynamic = "force-dynamic";

export default async function LinksPage({ params }: { params: Promise<{ id: string }> }) {
  const session = (await getSession())!;
  const { id } = await params;
  const website = getWebsite(session.org.id, id);
  if (!website) return null;

  const items = all<{
    id: string;
    anchor_text: string;
    reason: string;
    priority: string;
    status: string;
    source_url: string | null;
    target_url: string | null;
  }>(
    `SELECT l.id, l.anchor_text, l.reason, l.priority, l.status,
            s.url AS source_url, t.url AS target_url
     FROM internal_links l
     JOIN pages s ON s.id = l.source_page_id
     JOIN pages t ON t.id = l.target_page_id
     WHERE l.website_id = ? AND l.tenant_id = ?
     ORDER BY CASE l.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, l.created_at DESC
     LIMIT 100`,
    id,
    session.org.id
  );

  const pageCount =
    row<{ n: number }>("SELECT COUNT(*) AS n FROM pages WHERE website_id = ?", id)?.n ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink-900">Internal linking</h2>
          <p className="text-sm text-ink-500">
            Suggestions come from crawled page text — only pages that already mention each other.
          </p>
        </div>
        <GenerateLinksButton websiteId={id} disabled={pageCount < 2 || items.length > 0} />
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="No link suggestions yet"
          description={
            pageCount < 2
              ? "Crawl at least two pages before link suggestions can be generated."
              : "Generate suggestions — they are derived strictly from observed page text, no guesses."
          }
        />
      ) : (
        <Card className="divide-y divide-ink-100 p-0">
          {items.map((l) => (
            <div key={l.id} className="px-5 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-ink-900">“{l.anchor_text}”</span>
                <Badge tone={l.priority}>{l.priority}</Badge>
                <Badge tone={l.status === "suggested" ? "new" : l.status === "accepted" ? "approved" : "ignored"}>
                  {l.status}
                </Badge>
              </div>
              <div className="mt-1 text-sm text-ink-600">{l.reason}</div>
              <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-ink-400">
                <span className="truncate">from: {l.source_url}</span>
                <span className="truncate">→ {l.target_url}</span>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
