import { getSession } from "@/lib/auth/get-session";
import { getWebsite } from "@/lib/websites/repo";
import { all } from "@/lib/db/db";
import { Badge, Card, EmptyState, ProgressBar } from "@/components/ui";

export const dynamic = "force-dynamic";

interface TopicRow {
  name: string;
  is_pillar: number;
  coverage: number;
  status: string;
}

export default async function TopicsPage({ params }: { params: Promise<{ id: string }> }) {
  const session = (await getSession())!;
  const { id } = await params;
  const website = getWebsite(session.org.id, id);
  if (!website) return null;

  const stored = all<TopicRow>(
    "SELECT name, is_pillar, coverage, status FROM topics WHERE website_id = ? AND tenant_id = ? ORDER BY is_pillar DESC, coverage DESC LIMIT 100",
    id,
    session.org.id
  );

  // Derive topics from observed keyword/question data when the topic map is empty.
  const keywordGroups = all<{ intent: string; n: number; sample: string }>(
    `SELECT intent, COUNT(*) AS n, MIN(term) AS sample
     FROM keywords WHERE website_id = ? AND tenant_id = ? GROUP BY intent ORDER BY n DESC`,
    id,
    session.org.id
  );
  const questionCount =
    all<{ n: number }>("SELECT COUNT(*) AS n FROM questions WHERE website_id = ?", id).length > 0
      ? all<{ intent: string; n: number; sample: string }>(
          "SELECT intent, COUNT(*) AS n, MIN(text) AS sample FROM questions WHERE website_id = ? GROUP BY intent",
          id,
          session.org.id
        )
      : [];

  const derived: TopicRow[] = (stored.length ? [] : keywordGroups).map((k) => ({
    name: `${k.sample ?? k.intent} cluster`,
    is_pillar: k.n > 3 ? 1 : 0,
    coverage: Math.min(100, k.n * 20),
    status: k.n > 3 ? "covered" : "thin",
  }));

  const topics = stored.length ? stored : derived;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-ink-900">Topic authority map</h2>
        <p className="text-sm text-ink-500">
          Coverage is computed from crawled keywords and questions — never estimated traffic.
        </p>
      </div>

      {topics.length === 0 ? (
        <EmptyState
          title="No topics yet"
          description="Run a crawl — keyword and question clusters appear here as topic groups."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {topics.map((t) => (
            <Card key={t.name} className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium text-ink-900">{t.name}</span>
                {t.is_pillar ? <Badge tone="new">pillar</Badge> : null}
              </div>
              <ProgressBar value={t.coverage} />
              <div className="flex items-center justify-between text-xs text-ink-500">
                <span>coverage {t.coverage}%</span>
                <Badge tone={t.status === "covered" ? "completed" : t.status === "missing" ? "critical" : "medium"}>
                  {t.status}
                </Badge>
              </div>
            </Card>
          ))}
        </div>
      )}

      {questionCount.length > 0 ? (
        <Card className="space-y-2">
          <h3 className="text-sm font-semibold text-ink-900">Question clusters (AEO)</h3>
          <div className="flex flex-wrap gap-2">
            {questionCount.map((q) => (
              <Badge key={q.intent} tone="low">
                {q.intent}: {q.n}
              </Badge>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
