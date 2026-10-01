import { getSession } from "@/lib/auth/get-session";
import { getWebsite } from "@/lib/websites/repo";
import { all, row } from "@/lib/db/db";
import { Badge, Card, EmptyState } from "@/components/ui";
import { SchemaGenerator } from "@/components/schema-actions";

export const dynamic = "force-dynamic";

export default async function SchemaPage({ params }: { params: Promise<{ id: string }> }) {
  const session = (await getSession())!;
  const { id } = await params;
  const website = getWebsite(session.org.id, id);
  if (!website) return null;

  const items = all<{
    id: string;
    schema_type: string;
    json_ld: string;
    status: string;
    page_url: string | null;
    created_at: string;
  }>(
    `SELECT s.id, s.schema_type, s.json_ld, s.status, p.url AS page_url, s.created_at
     FROM schema_markup s LEFT JOIN pages p ON p.id = s.page_id
     WHERE s.website_id = ? AND s.tenant_id = ?
     ORDER BY s.created_at DESC LIMIT 100`,
    id,
    session.org.id
  );

  const pages = all<{ id: string; url: string; title: string | null }>(
    "SELECT id, url, title FROM pages WHERE website_id = ? AND tenant_id = ? ORDER BY depth = 0 DESC, url LIMIT 100",
    id,
    session.org.id
  );

  const pendingAnswers =
    row<{ n: number }>(
      "SELECT COUNT(*) AS n FROM questions WHERE website_id = ? AND recommended_answer IS NOT NULL",
      id
    )?.n ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink-900">Schema markup</h2>
          <p className="text-sm text-ink-500">
            JSON-LD generated from crawled page data (rules-first, no AI key required).
          </p>
        </div>
        <SchemaGenerator websiteId={id} pages={pages} />
      </div>

      <Card className="px-4 py-3 text-xs text-ink-500">
        FAQPage schema is only meaningful once AEO answers are approved — {pendingAnswers} answer(s) currently
        drafted for this website.
      </Card>

      {items.length === 0 ? (
        <EmptyState
          title="No schema generated yet"
          description="Pick a page and a schema type to produce JSON-LD you can paste into your site. Drafts are never injected automatically."
        />
      ) : (
        <div className="space-y-3">
          {items.map((s) => (
            <Card key={s.id} className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="new">{s.schema_type}</Badge>
                <Badge tone={s.status === "approved" ? "approved" : "new"}>{s.status}</Badge>
                <span className="truncate text-xs text-ink-400">{s.page_url ?? "site-wide"}</span>
                <span className="ml-auto text-xs text-ink-400">{s.created_at.slice(0, 10)}</span>
              </div>
              <pre className="max-h-56 overflow-auto rounded-lg bg-ink-950 p-3 text-xs text-ink-100">
                {(() => {
                  try {
                    return JSON.stringify(JSON.parse(s.json_ld), null, 2);
                  } catch {
                    return s.json_ld;
                  }
                })()}
              </pre>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
