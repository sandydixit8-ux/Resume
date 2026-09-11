import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Opportunity } from "@/types/supabase";

export interface PipelineMiniRow {
  stage_id: string;
  stage_name: string;
  value: number;
  count: number;
}

export async function getPipelineMini(): Promise<PipelineMiniRow[]> {
  const supabase = await createClient();
  const { data: stages } = await supabase
    .from("pipeline_stages")
    .select("id, name, probability, sort_order")
    .order("sort_order");
  const { data: opps } = await supabase
    .from("opportunities")
    .select("stage_id, value")
    .eq("status", "OPEN");

  const byStage = new Map<string, PipelineMiniRow>();
  (stages ?? []).forEach((s) =>
    byStage.set(s.id, { stage_id: s.id, stage_name: s.name, value: 0, count: 0 })
  );
  (opps ?? []).forEach((o) => {
    const row = byStage.get(o.stage_id);
    if (row) {
      row.value += Number(o.value || 0);
      row.count += 1;
    }
  });
  return [...byStage.values()];
}

export interface KanbanOpp extends Opportunity {
  customer_name?: string | null;
  customer_mobile?: string | null;
  owner_name?: string | null;
  days_inactive: number;
}

export interface KanbanData {
  stages: { id: string; name: string; probability: number; sort_order: number; is_winning: boolean; is_losing: boolean }[];
  opportunities: KanbanOpp[];
}

export async function getKanbanBoard(): Promise<KanbanData> {
  const supabase = await createClient();
  const { data: stages } = await supabase
    .from("pipeline_stages")
    .select("id, name, probability, sort_order, is_winning, is_losing")
    .order("sort_order");

  const { data: opps } = await supabase
    .from("opportunities")
    .select("*")
    .eq("status", "OPEN")
    .order("created_at", { ascending: false })
    .limit(200);

  const customerIds = [...new Set((opps ?? []).map((o) => o.customer_id).filter(Boolean))] as string[];
  const ownerIds = [...new Set((opps ?? []).map((o) => o.owner_id).filter(Boolean))] as string[];
  const [customersRes, ownersRes] = await Promise.all([
    customerIds.length ? supabase.from("customers").select("id, name, mobile").in("id", customerIds) : Promise.resolve({ data: [] }),
    ownerIds.length ? supabase.from("users").select("id, full_name").in("id", ownerIds) : Promise.resolve({ data: [] }),
  ]);

  const customerNames = new Map((customersRes.data ?? []).map((c) => [c.id, { name: c.name, mobile: c.mobile }]));
  const ownerNames = new Map((ownersRes.data ?? []).map((u) => [u.id, u.full_name]));

  const now = Date.now();
  const opportunities: KanbanOpp[] = ((opps ?? []) as Opportunity[]).map((o) => ({
    ...o,
    customer_name: o.customer_id ? customerNames.get(o.customer_id)?.name ?? null : null,
    customer_mobile: o.customer_id ? customerNames.get(o.customer_id)?.mobile ?? null : null,
    owner_name: o.owner_id ? ownerNames.get(o.owner_id) ?? null : null,
    days_inactive: o.last_activity_at
      ? Math.max(0, Math.floor((now - new Date(o.last_activity_at).getTime()) / 86400000))
      : Math.max(0, Math.floor((now - new Date(o.created_at).getTime()) / 86400000)),
  }));

  return { stages: stages ?? [], opportunities };
}