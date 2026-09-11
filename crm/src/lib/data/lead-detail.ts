import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Lead, Activity, Followup, Quotation, Message } from "@/types/supabase";

export interface LeadDetail {
  lead: Lead;
  ownerName: string | null;
  createdByName: string | null;
  activities: Activity[];
  followups: Followup[];
  quotations: Quotation[];
  messages: Message[];
}

export async function getLeadDetail(id: string): Promise<LeadDetail | null> {
  const supabase = await createClient();

  const { data: lead } = await supabase.from("leads").select("*").eq("id", id).eq("is_deleted", false).maybeSingle();
  if (!lead) return null;

  const [ownerRes, createdByRes, activitiesRes, followupsRes, quotationsRes, messagesRes] =
    await Promise.all([
      lead.owner_id
        ? supabase.from("users").select("full_name").eq("id", lead.owner_id).maybeSingle()
        : Promise.resolve({ data: null }),
      lead.created_by
        ? supabase.from("users").select("full_name").eq("id", lead.created_by).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("activities")
        .select("*")
        .eq("entity_type", "lead")
        .eq("entity_id", id)
        .order("performed_at", { ascending: false })
        .limit(100),
      supabase
        .from("followups")
        .select("*")
        .eq("entity_type", "lead")
        .eq("entity_id", id)
        .order("due_at", { ascending: false })
        .limit(50),
      supabase
        .from("quotations")
        .select("*")
        .eq("lead_id", id)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("messages")
        .select("*")
        .eq("entity_type", "lead")
        .eq("entity_id", id)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

  return {
    lead: lead as Lead,
    ownerName: (ownerRes.data as { full_name: string } | null)?.full_name ?? null,
    createdByName: (createdByRes.data as { full_name: string } | null)?.full_name ?? null,
    activities: (activitiesRes.data ?? []) as Activity[],
    followups: (followupsRes.data ?? []) as Followup[],
    quotations: (quotationsRes.data ?? []) as Quotation[],
    messages: (messagesRes.data ?? []) as Message[],
  };
}