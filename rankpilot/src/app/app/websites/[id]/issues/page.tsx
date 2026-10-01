import Link from "next/link";
import { getSession } from "@/lib/auth/get-session";
import { getWebsite } from "@/lib/websites/repo";
import { all, row } from "@/lib/db/db";
import { Badge, Card } from "@/components/ui";

export const dynamic = "force-dynamic";

const SEVERITIES = ["critical", "high", "medium", "low"] as const;

function buildUrl(base: string, params: Record<string, string | undefined>) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v);
  const s = qs.toString();
  return s ? `${base}?${s}` : base;
}

export default async function IssuesPage({
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

  const severity = typeof sp.severity === "string" ? sp.severity : undefined;
  const status = typeof sp.status === "string" ? sp.status : undefined;
  const category = typeof sp.category === "string" ? sp.category : undefined;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const limit = 25;
  const offset = (page - 1) * limit;

  const where = ["i.website_id = ?", "i.tenant_id = ?"];
  const args: Array<string | number> = [id, session.org.id];
  if (severity) {
    where.push("i.severity = ?");
    args.push(severity);
  }
  if (status) {
    where.push("i.status = ?");
    args.push(status);
  }
  if (category) {
    where.push("i.category = ?");
    args.push(category);
  }
  const whereSql = where.join(" AND ");

  const total = row<{ n: number }>(`SELECT COUNT(*) AS n FROM seo_issues i WHERE ${whereSql}`, ...args)?.n ?? 0;
  const items = all<{
    id: string;
    code: string;
    category: string;
    severity: string;
    title: string;
    status: string;
    why_it_matters: string;
    page_url: string | null;
    first_seen_at: string;
  }>(
    `SELECT i.id, i.code, i.category, i.severity, i.title, i.status, i.why_it_matters,
            i.first_seen_at, p.url AS page_url
     FROM seo_issues i LEFT JOIN pages p ON p.id = i.page_id
     WHERE ${whereSql}
     ORDER BY CASE i.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
              i.created_at ASC
     LIMIT ? OFFSET ?`,
    ...args,
    limit,
    offset
  );

  const counts = all<{ severity: string; n: number }>(
    "SELECT severity, COUNT(*) AS n FROM seo_issues WHERE website_id = ? AND status = 'new' GROUP BY severity",
    id
  );
  const countMap = Object.fromEntries(counts.map((c) => [c.severity, c.n]));
  const base = `/app/websites/${id}/issues`;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link href={buildUrl(base, {})}><Badge tone={!severity ? "new" : "low"}>All {total}</Badge></Link>
        {SEVERITIES.map((sv) => (
          <Link key={sv} href={buildUrl(base, { severity: sv, status })}>
            <Badge tone={severity === sv ? "new" : sv}>
              {sv} {countMap[sv] ?? 0}
            </Badge>
          </Link>
        ))}
        <span className="mx-1 h-5 w-px bg-ink-200" />
        <Link href={buildUrl(base, {})}><Badge tone={status ? "low" : "new"}>open</Badge></Link>
        <Link href={buildUrl(base, { status: "in_progress" })}><Badge tone={status === "in_progress" ? "new" : "low"}>in progress</Badge></Link>
        <Link href={buildUrl(base, { status: "resolved" })}><Badge tone={status === "resolved" ? "completed" : "low"}>resolved</Badge></Link>
        <Link href={buildUrl(base, { status: "ignored" })}><Badge tone={status === "ignored" ? "ignored" : "low"}>ignored</Badge></Link>
      </div>

      <Card className="divide-y divide-ink-100 p-0">
        {items.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-ink-500">
            No issues match these filters. Run a crawl to populate this list.
          </p>
        ) : (
          items.map((i) => (
            <div key={i.id} className="flex items-start justify-between gap-4 px-5 py-4">
              <div className="min-w-0">
                <Link href={`${base}/${i.id}`} className="block truncate text-sm font-medium text-ink-900 hover:text-brand-700">
                  <span className="mr-2 font-mono text-xs text-ink-400">{i.code}</span>
                  {i.title}
                </Link>
                <div className="mt-1 line-clamp-1 text-xs text-ink-500">{i.why_it_matters}</div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <Badge tone={i.severity}>{i.severity}</Badge>
                  <Badge tone="low">{i.category}</Badge>
                  <Badge tone={i.status === "resolved" ? "resolved" : i.status === "in_progress" ? "in_progress" : i.status === "ignored" ? "ignored" : "new"}>
                    {i.status}
                  </Badge>
                  {i.page_url ? (
                    <span className="truncate text-xs text-ink-400">{i.page_url}</span>
                  ) : (
                    <span className="text-xs text-ink-400">site-wide</span>
                  )}
                </div>
              </div>
              <Link href={`${base}/${i.id}`} className="btn-ghost shrink-0">
                Review
              </Link>
            </div>
          ))
        )}
      </Card>

      {totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm">
          <span className="text-ink-500">
            Page {page} of {totalPages} · {total} issues
          </span>
          <div className="flex gap-2">
            {page > 1 ? (
              <Link className="btn-ghost" href={buildUrl(base, { severity, status, category, page: String(page - 1) })}>
                ← Previous
              </Link>
            ) : null}
            {page < totalPages ? (
              <Link className="btn-ghost" href={buildUrl(base, { severity, status, category, page: String(page + 1) })}>
                Next →
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
