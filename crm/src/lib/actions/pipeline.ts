"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit";

export async function moveOpportunity(opportunityId: string, stageId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false as const, error: "Not signed in." };

  const { data: profile } = await supabase
    .from("users")
    .select("organization_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.organization_id) return { success: false as const, error: "No organization." };

  const { data: opp } = await supabase
    .from("opportunities")
    .select("id, stage_id, stage:pipeline_stages(probability, is_winning, is_losing, name)")
    .eq("id", opportunityId)
    .maybeSingle();
  if (!opp) return { success: false as const, error: "Opportunity not found." };

  const { data: newStage } = await supabase
    .from("pipeline_stages")
    .select("id, probability, is_winning, is_losing, name")
    .eq("id", stageId)
    .maybeSingle();
  if (!newStage) return { success: false as const, error: "Stage not found." };

  const update: Record<string, unknown> = {
    stage_id: stageId,
    probability: newStage.probability,
    updated_by: user.id,
  };
  const status = newStage.is_winning ? "WON" : newStage.is_losing ? "LOST" : "OPEN";
  if (status === "WON" || status === "LOST") {
    update.status = status;
    update.closed_at = new Date().toISOString();
  } else {
    update.status = status;
    update.closed_at = null;
  }

  const { error } = await supabase.from("opportunities").update(update).eq("id", opportunityId);
  if (error) {
    console.error("moveOpportunity failed", error);
    return { success: false as const, error: "Could not move the opportunity." };
  }

  await supabase.from("activities").insert({
    organization_id: profile.organization_id,
    entity_type: "opportunity",
    entity_id: opportunityId,
    activity_type: "system",
    summary: `Opportunity moved to ${newStage.name}`,
    created_by: user.id,
  });

  await writeAuditLog({
    action: "opportunity.stage_changed",
    entity: "opportunity",
    entity_id: opportunityId,
    old_value: { stage_id: opp.stage_id },
    new_value: { stage_id: stageId, status },
    organization_id: profile.organization_id,
  });

  revalidatePath("/pipeline");
  return { success: true as const, data: { stage: newStage.name } };
}