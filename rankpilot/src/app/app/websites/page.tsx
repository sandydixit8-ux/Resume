import Link from "next/link";
import { getSession } from "@/lib/auth/get-session";
import { listWebsites } from "@/lib/websites/repo";
import { Badge, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function WebsitesPage() {
  const session = (await getSession())!;
  const websites = listWebsites(session.org.id);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-900">Websites</h1>
          <p className="text-sm text-ink-500">{websites.length} in this workspace</p>
        </div>
        <Link href="/onboarding" className="btn-primary">
          Add website
        </Link>
      </div>

      {websites.length === 0 ? (
        <EmptyState
          title="No websites yet"
          description="Add your first URL and RankPilot will crawl, audit and prioritize every opportunity."
          action={<Link href="/onboarding" className="btn-primary">Analyze my website</Link>}
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-ink-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-400">
              <tr>
                <th className="px-4 py-3 font-medium">Website</th>
                <th className="px-4 py-3 font-medium">Score</th>
                <th className="px-4 py-3 font-medium">Open issues</th>
                <th className="px-4 py-3 font-medium">Last crawl</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {websites.map((w) => (
                <tr key={w.id} className="hover:bg-ink-50/60">
                  <td className="px-4 py-3">
                    <Link href={`/app/websites/${w.id}`} className="font-medium text-ink-900 hover:text-brand-700">
                      {w.name}
                    </Link>
                    <div className="text-xs text-ink-400">{w.normalized_url}</div>
                  </td>
                  <td className="px-4 py-3">
                    {w.score !== null ? (
                      <span className={`font-semibold ${w.score >= 80 ? "text-emerald-600" : w.score >= 60 ? "text-brand-600" : w.score >= 40 ? "text-amber-600" : "text-red-600"}`}>
                        {w.score}
                      </span>
                    ) : (
                      <span className="text-ink-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-ink-700">{w.issues_open}</td>
                  <td className="px-4 py-3 text-ink-500">{w.last_crawled_at ? w.last_crawled_at.slice(0, 16).replace("T", " ") : "never"}</td>
                  <td className="px-4 py-3">
                    <Badge tone={w.last_run_status === "running" || w.last_run_status === "queued" ? "new" : w.last_run_status === "failed" ? "critical" : "low"}>
                      {w.last_run_status ?? "not crawled"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/app/websites/${w.id}`} className="btn-ghost">Open</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
