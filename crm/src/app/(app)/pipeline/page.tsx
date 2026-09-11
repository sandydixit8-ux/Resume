import type { Metadata } from "next";
import { getKanbanBoard } from "@/lib/data/pipeline";
import { KanbanBoard } from "@/components/pipeline/kanban-board";
import { EmptyState } from "@/components/ui/empty-state";
import { GitBranch } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = { title: "Sales Pipeline" };
export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const data = await getKanbanBoard();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Sales pipeline</h2>
          <p className="text-xs text-muted-foreground">
            Drag cards between stages. Moves are permission-controlled and audited.
          </p>
        </div>
      </div>

      {data.opportunities.length === 0 ? (
        <EmptyState
          icon={GitBranch}
          title="No open opportunities"
          description="Convert a lead to a customer and create an opportunity, or the pipeline stays empty here."
          action={
            <Link href="/leads" className="text-xs font-medium text-[var(--primary)] hover:underline">
              Go to leads
            </Link>
          }
        />
      ) : (
        <KanbanBoard data={data} />
      )}
    </div>
  );
}