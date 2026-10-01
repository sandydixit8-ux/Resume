import { getSession } from "@/lib/auth/get-session";
import { getWebsite } from "@/lib/websites/repo";
import { all, row } from "@/lib/db/db";
import { Badge, Card, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function KeywordsPage({
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

  const q = typeof sp.q === "string" ? sp.q : "";
  const where = ["website_id = ?"];
  const args: Array<string | number> = [id];
  if (q) {
    where.push("term LIKE ?");
    args.push(`%${q}%`);
  }
  const whereSql = where.join(" AND ");
  const total = row<{ n: number }>(`SELECT COUNT(*) AS n FROM keywords WHERE ${whereSql}`, ...args)?.n ?? 0;

  const items = all<{
    id: string;
    term: string;
    source: string;
    intent: string;
    occurrences: number;
    recommended_url: string | null;
  }>(
    `SELECT id, term, source, intent, occurrences, recommended_url
     FROM keywords WHERE ${whereSql} ORDER BY occurrences DESC, term ASC LIMIT 300`,
    ...args
  );

  const byIntent = all<{ intent: string; n: number }>(
    "SELECT intent, COUNT(*) AS n FROM keywords WHERE website_id = ? GROUP BY intent",
    id
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          <Badge tone="new">Total {total}</Badge>
          {byIntent.map((i) => (
            <Badge key={i.intent} tone="low">
              {i.intent}: {i.n}
            </Badge>
          ))}
        </div>
        <form className="flex gap-2">
          <input name="q" defaultValue={q} placeholder="Search keywords…" className="input w-56" />
          <button className="btn-secondary">Search</button>
        </form>
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="No keywords discovered yet"
          description="We extract keyword and topic signals from your crawled content. Run a crawl first."
        />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-400">
              <tr>
                <th className="px-4 py-3 font-medium">Term</th>
                <th className="px-4 py-3 font-medium">Intent</th>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium">Occurrences</th>
                <th className="px-4 py-3 font-medium">Recommended URL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {items.map((k) => (
                <tr key={k.id} className="hover:bg-ink-50/60">
                  <td className="px-4 py-2.5 font-medium text-ink-900">{k.term}</td>
                  <td className="px-4 py-2.5"><Badge tone="low">{k.intent}</Badge></td>
                  <td className="px-4 py-2.5 text-ink-500">{k.source}</td>
                  <td className="px-4 py-2.5 text-ink-700">{k.occurrences}</td>
                  <td className="max-w-sm truncate px-4 py-2.5 text-ink-500">{k.recommended_url ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      <p className="text-xs text-ink-400">
        Volume, difficulty and rank columns show “Data unavailable” until a connected source
        (e.g. Google Search Console) provides real numbers — we never fabricate them.
      </p>
    </div>
  );
}
