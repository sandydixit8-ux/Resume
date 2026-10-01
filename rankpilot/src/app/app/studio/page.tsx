import Link from "next/link";
import { getSession } from "@/lib/auth/get-session";
import { all } from "@/lib/db/db";
import { Badge, Card, EmptyState } from "@/components/ui";
import { NewDraftButton } from "@/components/studio";

export const dynamic = "force-dynamic";

export default async function StudioPage() {
  const session = (await getSession())!;
  const items = all<{
    id: string;
    title: string;
    type: string;
    status: string;
    updated_at: string;
    website_id: string | null;
    website_name: string | null;
  }>(
    `SELECT c.id, c.title, c.type, c.status, c.updated_at, w.name AS website_name, c.website_id
     FROM content c LEFT JOIN websites w ON w.id = c.website_id
     WHERE c.tenant_id = ? AND c.deleted_at IS NULL
     ORDER BY c.updated_at DESC LIMIT 100`,
    session.org.id
  );

  const websites = all<{ id: string; name: string }>(
    "SELECT id, name FROM websites WHERE tenant_id = ? AND deleted_at IS NULL ORDER BY name",
    session.org.id
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-900">AI Content Studio</h1>
          <p className="text-sm text-ink-500">
            Generate drafts from your crawl data. Nothing publishes without your approval.
          </p>
        </div>
        {websites.length ? <NewDraftButton websites={websites} /> : null}
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="No drafts yet"
          description={
            websites.length
              ? "Create your first draft — it will be grounded in your website's crawl data and saved as an approval-gated draft."
              : "Add a website first, then come back to generate drafts from its crawl data."
          }
          action={
            websites.length ? null : (
              <Link href="/app/websites" className="btn-primary">
                Add a website
              </Link>
            )
          }
        />
      ) : (
        <Card className="divide-y divide-ink-100 p-0">
          {items.map((c) => (
            <Link
              key={c.id}
              href={`/app/studio/${c.id}`}
              className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-ink-50"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-ink-900">{c.title}</div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <Badge tone="low">{c.type}</Badge>
                  <Badge tone={c.status === "approved" ? "approved" : c.status === "published" ? "completed" : "new"}>
                    {c.status}
                  </Badge>
                  <span className="text-xs text-ink-400">{c.website_name ?? "no website"}</span>
                </div>
              </div>
              <span className="shrink-0 text-xs text-ink-400">{c.updated_at.slice(0, 10)}</span>
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
