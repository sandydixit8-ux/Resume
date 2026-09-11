import type { Metadata } from "next";
import { Plus } from "lucide-react";
import Link from "next/link";
import { isTaskView, listTasksFeed, getTaskCounts, getEntityCandidates, type TaskView } from "@/lib/data/tasks";
import { TasksClient } from "@/components/tasks/tasks-client";

export const metadata: Metadata = { title: "Tasks & Follow-ups" };
export const dynamic = "force-dynamic";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const sp = await searchParams;
  const view: TaskView = isTaskView(sp.view) ? sp.view : "today";

  const [items, counts, candidates] = await Promise.all([listTasksFeed(view), getTaskCounts(), getEntityCandidates()]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">Tasks & Follow-ups</h1>
          <p className="text-xs text-muted-foreground">Stay on top of every follow-up, call and visit.</p>
        </div>
        <Link
          href="/tasks"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 py-2 text-xs font-medium text-white shadow-sm"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">New follow-up</span>
        </Link>
      </div>

      <TasksClient view={view} items={items} counts={counts} candidates={candidates} />
    </div>
  );
}