import Link from "next/link";
import { getSession } from "@/lib/auth/get-session";
import { all } from "@/lib/db/db";
import { Badge, Card, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

const DAY = 24 * 60 * 60 * 1000;

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = (await getSession())!;
  const sp = await searchParams;
  const windowDays = Math.min(90, Math.max(7, Number(sp.window ?? 30) || 30));
  const now = new Date();
  const from = now.toISOString();
  const to = new Date(now.getTime() + windowDays * DAY).toISOString();

  const items = all<{
    id: string;
    publish_at: string;
    platform: string;
    topic: string;
    format: string;
    hook: string;
    status: string;
  }>(
    `SELECT id, publish_at, platform, topic, format, hook, status
     FROM content_calendar WHERE tenant_id = ? AND publish_at >= ? AND publish_at <= ?
     ORDER BY publish_at ASC LIMIT 300`,
    session.org.id,
    from,
    to
  );

  const buckets: Array<{ label: string; start: Date; end: Date; rows: typeof items }> = [];
  const per = Math.max(7, Math.floor(windowDays / 4));
  for (let i = 0; i < windowDays; i += per) {
    const start = new Date(now.getTime() + i * DAY);
    const end = new Date(Math.min(now.getTime() + (i + per) * DAY, now.getTime() + windowDays * DAY));
    buckets.push({
      label: `${start.toISOString().slice(5, 10)} → ${end.toISOString().slice(5, 10)}`,
      start,
      end,
      rows: items.filter((it) => {
        const t = new Date(it.publish_at).getTime();
        return t >= start.getTime() && t < end.getTime();
      }),
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-900">Content calendar</h1>
          <p className="text-sm text-ink-500">Planned slots for the next {windowDays} days — drafts only.</p>
        </div>
        <div className="flex gap-1">
          {[7, 14, 30, 90].map((d) => (
            <Link
              key={d}
              href={`/app/social/calendar?window=${d}`}
              className={`btn-ghost ${windowDays === d ? "bg-brand-50 text-brand-700" : ""}`}
            >
              {d}d
            </Link>
          ))}
          <Link href="/app/social" className="btn-secondary">
            Campaigns
          </Link>
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="Nothing scheduled"
          description="Schedule ideas from a campaign to see them plotted here."
          action={
            <Link href="/app/social" className="btn-primary">
              Go to campaigns
            </Link>
          }
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {buckets.map((b) => (
            <Card key={b.label} className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-ink-400">{b.label}</div>
              {b.rows.length === 0 ? (
                <p className="text-xs text-ink-400">Open</p>
              ) : (
                b.rows.map((r) => (
                  <div key={r.id} className="rounded-lg border border-ink-100 bg-ink-50 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-medium text-ink-800">{r.topic}</span>
                      <Badge tone={r.status === "published" ? "completed" : "new"}>{r.status}</Badge>
                    </div>
                    <div className="mt-1 text-[11px] text-ink-400">
                      {r.publish_at.slice(5, 16).replace("T", " ")} · {r.platform}
                      {r.format ? ` · ${r.format}` : ""}
                    </div>
                    {r.hook ? <div className="mt-1 truncate text-[11px] text-brand-700">“{r.hook}”</div> : null}
                  </div>
                ))
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
