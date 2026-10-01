import { getSession } from "@/lib/auth/get-session";
import { getWebsite } from "@/lib/websites/repo";
import { all, row } from "@/lib/db/db";
import { Badge, Card, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function QuestionsPage({ params }: { params: Promise<{ id: string }> }) {
  const session = (await getSession())!;
  const { id } = await params;
  const website = getWebsite(session.org.id, id);
  if (!website) return null;

  const total = row<{ n: number }>("SELECT COUNT(*) AS n FROM questions WHERE website_id = ?", id)?.n ?? 0;
  const items = all<{
    id: string;
    text: string;
    intent: string;
    priority: string;
    source: string;
    recommended_answer: string | null;
    recommended_url: string | null;
    schema_type: string | null;
  }>(
    `SELECT id, text, intent, priority, source, recommended_answer, recommended_url, schema_type
     FROM questions WHERE website_id = ?
     ORDER BY CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, created_at ASC
     LIMIT 200`,
    id
  );

  const byPriority = all<{ priority: string; n: number }>(
    "SELECT priority, COUNT(*) AS n FROM questions WHERE website_id = ? GROUP BY priority",
    id
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          <Badge tone="new">Total {total}</Badge>
          {byPriority.map((p) => (
            <Badge key={p.priority} tone={p.priority === "high" ? "high" : "low"}>
              {p.priority}: {p.n}
            </Badge>
          ))}
        </div>
        <span className="text-xs text-ink-400">AEO — questions your audience asks &amp; answer engines match</span>
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="No questions discovered yet"
          description="RankPilot mines your content and site patterns for questions worth answering explicitly — run a crawl first."
        />
      ) : (
        <div className="space-y-3">
          {items.map((q) => (
            <Card key={q.id} className="p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={q.priority === "high" ? "high" : q.priority === "medium" ? "medium" : "low"}>
                  {q.priority} priority
                </Badge>
                <Badge tone="low">{q.intent}</Badge>
                <Badge tone="low">{q.source}</Badge>
                {q.schema_type ? <Badge tone="new">schema: {q.schema_type}</Badge> : null}
              </div>
              <p className="mt-2.5 font-medium text-ink-900">{q.text}</p>
              {q.recommended_answer ? (
                <div className="mt-2 rounded-xl border border-brand-100 bg-brand-50 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-brand-500">
                    Suggested answer
                  </div>
                  <p className="mt-1 text-sm leading-6 text-ink-700">{q.recommended_answer}</p>
                </div>
              ) : (
                <p className="mt-1.5 text-sm text-ink-500">
                  No suggested answer yet — AI Content Studio will draft one for approval.
                </p>
              )}
              {q.recommended_url ? (
                <div className="mt-2 text-xs text-ink-400">Recommended placement: {q.recommended_url}</div>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
