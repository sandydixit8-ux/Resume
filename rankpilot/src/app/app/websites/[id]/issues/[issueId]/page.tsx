import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth/get-session";
import { getWebsite } from "@/lib/websites/repo";
import { all, row } from "@/lib/db/db";
import { Badge, Card } from "@/components/ui";
import { ISSUE_STATUSES, StatusSelect } from "@/components/controls";

export const dynamic = "force-dynamic";

function EvidenceBlock({ value }: { value: unknown }) {
  if (!value || (typeof value === "object" && Object.keys(value as object).length === 0)) {
    return <p className="text-sm text-ink-500">No extra evidence recorded for this issue.</p>;
  }
  return (
    <pre className="overflow-x-auto rounded-xl border border-ink-200 bg-ink-50 p-3 text-xs leading-5 text-ink-700">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

export default async function IssueDetailPage({
  params,
}: {
  params: Promise<{ id: string; issueId: string }>;
}) {
  const session = (await getSession())!;
  const { id, issueId } = await params;
  const website = getWebsite(session.org.id, id);
  if (!website) notFound();

  const issue = row<{
    id: string;
    code: string;
    category: string;
    severity: string;
    title: string;
    description: string;
    why_it_matters: string;
    recommendation: string;
    evidence: string;
    status: string;
    page_id: string | null;
    first_seen_at: string;
    last_seen_at: string;
  }>(
    "SELECT * FROM seo_issues WHERE id = ? AND website_id = ? AND tenant_id = ?",
    issueId,
    id,
    session.org.id
  );
  if (!issue) notFound();

  const page = issue.page_id
    ? row<{ id: string; url: string; title: string | null; h1: string | null; word_count: number; status_code: number | null }>(
        "SELECT id, url, title, h1, word_count, status_code FROM pages WHERE id = ?",
        issue.page_id
      )
    : undefined;

  const related = all<{ id: string; title: string; severity: string; status: string }>(
    "SELECT id, title, severity, status FROM seo_issues WHERE website_id = ? AND code = ? AND id != ? LIMIT 20",
    id,
    issue.code,
    issueId
  );

  const evidence = JSON.parse(issue.evidence || "{}") as unknown;

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        <Card className="p-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={issue.severity}>{issue.severity}</Badge>
            <Badge tone="low">{issue.category}</Badge>
            <span className="font-mono text-xs text-ink-400">{issue.code}</span>
          </div>
          <h2 className="mt-3 text-lg font-semibold text-ink-900">{issue.title}</h2>
          {issue.description ? <p className="mt-2 text-sm leading-6 text-ink-600">{issue.description}</p> : null}

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-ink-200 bg-ink-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-ink-400">Why it matters</div>
              <p className="mt-1.5 text-sm leading-6 text-ink-700">{issue.why_it_matters || "—"}</p>
            </div>
            <div className="rounded-xl border border-brand-100 bg-brand-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-brand-500">Recommended fix</div>
              <p className="mt-1.5 text-sm leading-6 text-ink-700">{issue.recommendation || "—"}</p>
            </div>
          </div>

          <div className="mt-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-ink-400">Evidence</div>
            <div className="mt-2">
              <EvidenceBlock value={evidence} />
            </div>
          </div>

          {page ? (
            <div className="mt-5 rounded-xl border border-ink-200 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-ink-400">Affected page</div>
              <a href={page.url} target="_blank" rel="noreferrer noopener" className="mt-1 block break-all text-sm font-medium text-brand-700 hover:underline">
                {page.url}
              </a>
              <div className="mt-1 text-xs text-ink-500">
                {page.title ?? "No title"} · HTTP {page.status_code ?? "?"} · {page.word_count} words
              </div>
            </div>
          ) : (
            <p className="mt-5 text-sm text-ink-500">This issue applies site-wide.</p>
          )}
        </Card>

        {related.length > 0 ? (
          <Card className="p-5">
            <div className="text-sm font-semibold uppercase tracking-wide text-ink-400">
              Related ({related.length})
            </div>
            <ul className="mt-3 space-y-2">
              {related.map((r) => (
                <li key={r.id}>
                  <Link href={`/app/websites/${id}/issues/${r.id}`} className="flex items-center justify-between gap-3 text-sm hover:text-brand-700">
                    <span className="truncate text-ink-700">{r.title}</span>
                    <span className="flex shrink-0 gap-1.5">
                      <Badge tone={r.severity}>{r.severity}</Badge>
                      <Badge tone={r.status === "resolved" ? "resolved" : "low"}>{r.status}</Badge>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </div>

      <div className="space-y-5">
        <Card className="p-5">
          <div className="text-sm font-semibold uppercase tracking-wide text-ink-400">Status</div>
          <div className="mt-3">
            <StatusSelect
              endpoint={`/api/issues/${issue.id}`}
              value={issue.status}
              options={ISSUE_STATUSES}
            />
          </div>
          <dl className="mt-4 space-y-2 text-xs text-ink-500">
            <div className="flex justify-between gap-2">
              <dt>First seen</dt>
              <dd>{new Date(issue.first_seen_at).toLocaleString()}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>Last seen</dt>
              <dd>{new Date(issue.last_seen_at).toLocaleString()}</dd>
            </div>
          </dl>
        </Card>

        <Card className="p-5 text-sm text-ink-600">
          <div className="text-xs font-semibold uppercase tracking-wide text-ink-400">How it was found</div>
          <p className="mt-2 leading-6">
            Detected automatically during your crawl by check <span className="font-mono">{issue.code}</span>.
            Resolving it in your code/CMS and re-running the crawl will mark it fixed — RankPilot
            re-checks every page on each run.
          </p>
        </Card>
      </div>
    </div>
  );
}
