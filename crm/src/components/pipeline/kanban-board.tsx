"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Move } from "lucide-react";
import type { KanbanData } from "@/lib/data/pipeline";
import { moveOpportunity } from "@/lib/actions/pipeline";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import { formatMoney, formatDate, cn } from "@/lib/utils";

export function KanbanBoard({ data }: { data: KanbanData }) {
  const router = useRouter();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const oppsByStage = new Map<string, KanbanData["opportunities"]>();
  data.stages.forEach((s) => oppsByStage.set(s.id, []));
  data.opportunities.forEach((o) => {
    const list = oppsByStage.get(o.stage_id);
    if (list) list.push(o);
  });

  async function onDrop(stageId: string) {
    if (!dragId) return;
    const target = data.stages.find((s) => s.id === stageId);
    setOverStage(null);
    setBusy(true);
    const res = await moveOpportunity(dragId, stageId);
    setBusy(false);
    setDragId(null);
    if (res.success) {
      if (target?.is_winning || target?.is_losing) {
        toast.success(`Moved to ${target.name} — opportunity ${target.is_winning ? "won" : "lost"}`);
      } else {
        toast.success(`Moved to ${target?.name ?? "stage"}`);
      }
      router.refresh();
    } else {
      toast.error(res.error ?? "Could not move");
    }
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-4" style={{ scrollSnapType: "x proximity" }}>
      {data.stages.map((stage) => {
        const cards = oppsByStage.get(stage.id) ?? [];
        const totalValue = cards.reduce((s, o) => s + Number(o.value || 0), 0);
        return (
          <div
            key={stage.id}
            onDragOver={(e) => {
              e.preventDefault();
              setOverStage(stage.id);
            }}
            onDragLeave={() => setOverStage((s) => (s === stage.id ? null : s))}
            onDrop={(e) => {
              e.preventDefault();
              onDrop(stage.id);
            }}
            className={cn(
              "flex w-[280px] shrink-0 flex-col rounded-xl border bg-zinc-50/60 transition-colors",
              overStage === stage.id ? "border-[var(--primary)] bg-orange-50/40" : "border-[var(--border)]"
            )}
          >
            <div className="flex items-center justify-between gap-2 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    stage.is_winning ? "bg-[var(--success)]" : stage.is_losing ? "bg-[var(--destructive)]" : "bg-[var(--primary)]"
                  )}
                />
                <span className="text-xs font-semibold">{stage.name}</span>
                <span className="rounded-full bg-white px-1.5 text-[10px] text-muted-foreground">{cards.length}</span>
              </div>
              <span className="text-[11px] font-medium tabular-nums text-muted-foreground">{formatMoney(totalValue)}</span>
            </div>
            <div className="flex flex-1 flex-col gap-2 px-2 pb-2">
              {cards.length === 0 ? (
                <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-[var(--border)] text-[11px] text-muted-foreground">
                  Drop here
                </div>
              ) : (
                cards.map((opp) => (
                  <div
                    key={opp.id}
                    draggable
                    onDragStart={() => setDragId(opp.id)}
                    onDragEnd={() => {
                      setDragId(null);
                      setOverStage(null);
                    }}
                    className={cn(
                      "cursor-pointer rounded-lg border border-[var(--border)] bg-white p-3 shadow-sm transition-shadow hover:shadow",
                      dragId === opp.id && "opacity-40"
                    )}
                  >
                    <p className="text-xs font-semibold leading-snug">{opp.name}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {opp.customer_name ?? "No customer"}
                    </p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-sm font-semibold tabular-nums">{formatMoney(opp.value)}</span>
                      <span className="text-[11px] text-muted-foreground">{Math.round(opp.probability)}%</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground">{opp.owner_name ?? "Unassigned"}</span>
                      <span className="flex items-center gap-1">
                        {opp.days_inactive >= 3 ? (
                          <Badge tone="warning">{opp.days_inactive}d inactive</Badge>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">
                            {opp.next_action_at ? formatDate(opp.next_action_at) : ""}
                          </span>
                        )}
                        <Move className="h-3 w-3 text-muted-foreground" />
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
      {busy ? (
        <div className="sr-only" role="status">
          Moving opportunity…
        </div>
      ) : null}
    </div>
  );
}