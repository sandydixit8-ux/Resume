import Link from "next/link";
import { getSession } from "@/lib/auth/get-session";
import { all } from "@/lib/db/db";
import { Card, EmptyState } from "@/components/ui";
import { Copilot } from "@/components/copilot";

export const dynamic = "force-dynamic";

export default async function CopilotPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = (await getSession())!;
  const sp = await searchParams;
  const threadId = sp.thread;

  const websites = all<{ id: string; name: string }>(
    "SELECT id, name FROM websites WHERE tenant_id = ? AND deleted_at IS NULL ORDER BY name",
    session.org.id
  );

  const threads = all<{ id: string; title: string; updated_at: string }>(
    "SELECT id, title, updated_at FROM copilot_threads WHERE tenant_id = ? ORDER BY updated_at DESC LIMIT 30",
    session.org.id
  );

  let initialMessages: Array<{ id: string; role: string; content: string; epistemic: string }> = [];
  if (threadId) {
    initialMessages = all(
      "SELECT id, role, content, epistemic FROM copilot_messages WHERE thread_id = ? ORDER BY created_at ASC LIMIT 100",
      threadId
    ) as typeof initialMessages;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">Growth copilot</h1>
        <p className="text-sm text-ink-500">
          Answers are split into observed data, AI interpretation and a recommendation. If data is missing, it says
          so — no invented metrics.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
        <Card className="h-fit space-y-2">
          <h2 className="text-sm font-semibold text-ink-900">Recent threads</h2>
          {threads.length === 0 ? (
            <p className="text-xs text-ink-400">No threads yet.</p>
          ) : (
            <ul className="space-y-1">
              {threads.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/app/copilot?thread=${t.id}`}
                    className="block truncate rounded-lg px-2 py-1.5 text-sm text-ink-600 hover:bg-ink-50"
                  >
                    {t.title}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-ink-100 pt-2">
            <Link href="/app/actions" className="text-xs text-brand-700 hover:underline">
              Open Action Center →
            </Link>
          </div>
        </Card>

        <div>
          {websites.length === 0 ? (
            <EmptyState
              title="Add a website first"
              description="The copilot answers from your crawl data, so it needs at least one website."
              action={
                <Link href="/app/websites" className="btn-primary">
                  Add website
                </Link>
              }
            />
          ) : (
            <Copilot websites={websites} initialThreadId={threadId} initialMessages={initialMessages} />
          )}
        </div>
      </div>
    </div>
  );
}
