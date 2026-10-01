import Link from "next/link";
import { getSession } from "@/lib/auth/get-session";
import { all } from "@/lib/db/db";
import { Badge, Card, EmptyState, StatCard } from "@/components/ui";
import { ACTION_STATUSES, StatusSelect } from "@/components/controls";

export const dynamic = "force-dynamic";

interface ActionRow {
  id: string;
  website_id: string;
  issue_id: string | null;
  title: string;
  description: string;
  priority: string;
  impact: string;
  effort: string;
  status: string;
  source: string;
  due_date: string | null;
  created_at: string;
  website_name: string | null;
}

export default async function ActionCenterPage() {
  const session = (await getSession())!;
  const items = all<ActionRow>(
    `SELECT a.id, a.website_id, a.issue_id, a.title, a.description, a.priority, a.impact,
            a.effort, a.status, a.source, a.due_date, a.created_at, w.name AS website_name
     FROM actions a LEFT JOIN websites w ON w.id = a.website_id
     WHERE a.tenant_id = ? AND (w.deleted_at IS NULL OR w.id IS NULL)
     ORDER BY CASE a.status WHEN 'completed' THEN 1 ELSE 0 END,
              CASE a.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
              a.created_at DESC
     LIMIT 200`,
    session.org.id
  );

  const open = items.filter((a) => a.status !== "completed");
  const byStatus = new Map<string, number>();
  for (const a of items) byStatus.set(a.status, (byStatus.get(a.status) ?? 0) + 1);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">Action Center</h1>
        <p className="text-sm text-ink-500">
          One prioritized backlog across SEO, content and social — highest impact first.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Open actions" value={open.length} />
        <StatCard label="High priority" value={open.filter((a) => a.priority === "high").length} />
        <StatCard label="In progress" value={byStatus.get("in_progress") ?? 0} />
        <StatCard label="Completed" value={byStatus.get("completed") ?? 0} />
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="No actions yet"
          description="Actions are created automatically from audit findings. Run a crawl to fill your backlog."
          action={<Link href="/onboarding" className="btn-primary">Run an audit</Link>}
        />
      ) : (
        <div className="space-y-3">
          {items.map((a) => (
            <Card key={a.id} className="flex flex-wrap items-start justify-between gap-4 p-5">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={a.priority === "high" ? "high" : a.priority === "medium" ? "medium" : "low"}>
                    {a.priority} priority
                  </Badge>
                  <Badge tone="low">impact: {a.impact}</Badge>
                  <Badge tone="low">effort: {a.effort}</Badge>
                  <Badge tone={a.status === "completed" ? "completed" : a.status === "in_progress" ? "in_progress" : a.status === "approved" ? "approved" : a.status === "review" ? "review" : "new"}>
                    {a.status}
                  </Badge>
                  <span className="text-xs text-ink-400">source: {a.source}</span>
                </div>
                <p className="mt-2 text-sm font-semibold text-ink-900">{a.title}</p>
                {a.description ? <p className="mt-1 text-sm text-ink-600">{a.description}</p> : null}
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-ink-400">
                  {a.website_name ? <span>Website: {a.website_name}</span> : null}
                  {a.due_date ? <span>Due: {a.due_date}</span> : null}
                  <span>Created: {new Date(a.created_at).toLocaleDateString()}</span>
                  {a.issue_id ? (
                    <Link href={`/app/websites/${a.website_id}/issues/${a.issue_id}`} className="text-brand-600 hover:underline">
                      View issue →
                    </Link>
                  ) : null}
                </div>
              </div>
              <StatusSelect endpoint={`/api/actions/${a.id}`} value={a.status} options={ACTION_STATUSES} />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
