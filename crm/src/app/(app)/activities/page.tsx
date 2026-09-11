import type { Metadata } from "next";
import { Plus } from "lucide-react";
import Link from "next/link";
import { listActivities } from "@/lib/data/activities";
import { getEntityCandidates } from "@/lib/data/tasks";
import { ActivitiesClient } from "@/components/activities/activities-client";

export const metadata: Metadata = { title: "Activities" };
export const dynamic = "force-dynamic";

export default async function ActivitiesPage() {
  const [activities, candidates] = await Promise.all([listActivities(60), getEntityCandidates()]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">Activities</h1>
          <p className="text-xs text-muted-foreground">Every call, message and meeting in one feed.</p>
        </div>
        <Link
          href="/activities"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 py-2 text-xs font-medium text-white shadow-sm"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Log activity</span>
        </Link>
      </div>

      <ActivitiesClient activities={activities} candidates={candidates} />
    </div>
  );
}