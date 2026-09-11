"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/audit";
import { computeLeadScore } from "@/lib/scoring";
import {
  createLeadSchema,
  updateLeadSchema,
  assignLeadsSchema,
  createFollowupSchema,
  logActivitySchema,
  createCustomerSchema,
  createVisitSchema,
} from "@/lib/validators";
import type { Json, Lead } from "@/types/supabase";

function fail(message: string) {
  return { success: false as const, error: message };
}
function ok(data?: unknown) {
  return { success: true as const, data };
}

async function sessionOrg(): Promise<{ userId: string; orgId: string; branchId: string | null } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("id, organization_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.organization_id) return null;

  const { data: firstBranch } = await supabase
    .from("user_branches")
    .select("branch_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  return { userId: user.id, orgId: profile.organization_id, branchId: firstBranch?.branch_id ?? null };
}

export async function createLead(_prev: unknown, formData: FormData) {
  const parsed = createLeadSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Please check the lead details.");
  }

  const ctx = await sessionOrg();
  if (!ctx) return fail("You must be signed in with an organization.");

  const supabase = await createClient();
  const data = parsed.data;

  // Duplicate detection: same mobile or email within the organization.
  if (data.mobile) {
    const { data: dup } = await supabase
      .from("leads")
      .select("id, name, mobile")
      .eq("is_deleted", false)
      .eq("mobile", data.mobile)
      .limit(1);
    if (dup && dup.length > 0) {
      return fail(
        `A lead with this mobile number already exists (${dup[0].name}). Use "Merge" on the existing lead instead of creating a duplicate.`
      );
    }
  }

  const interactions = data.owner_id ? 1 : 0;
  const score = computeLeadScore({
    source: data.source,
    value: data.value,
    interactions,
    lastContactedDaysAgo: null,
    priority: data.priority,
    hasNextFollowup: false,
  });

  const { count } = await supabase
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", ctx.orgId);
  const leadNo = `LD-${5000 + (count ?? 0) + 1}`;

  const { data: lead, error } = await supabase
    .from("leads")
    .insert({
      organization_id: ctx.orgId,
      branch_id: ctx.branchId,
      lead_no: leadNo,
      ...data,
      score: score.score,
      created_by: ctx.userId,
    })
    .select()
    .single();

  if (error) {
    console.error("createLead insert failed", error);
    return fail("Could not save the lead. Please try again.");
  }

  await writeAuditLog({
    action: "lead.created",
    entity: "lead",
    entity_id: lead.id,
    new_value: { name: lead.name, source: lead.source },
    organization_id: ctx.orgId,
  });

  revalidatePath("/leads");
  return ok({ id: lead.id });
}

export async function updateLead(id: string, _prev: unknown, formData: FormData) {
  const parsed = updateLeadSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Please check the details.");
  }
  const ctx = await sessionOrg();
  if (!ctx) return fail("Not signed in.");

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("leads")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!existing) return fail("Lead not found.");

  const update: Record<string, unknown> = { ...parsed.data, updated_by: ctx.userId };
  if (parsed.data.source || parsed.data.value || parsed.data.priority) {
    const score = computeLeadScore({
      source: parsed.data.source ?? existing.source,
      value: parsed.data.value ?? existing.value,
      interactions: 1,
      lastContactedDaysAgo: existing.last_contacted_at
        ? Math.floor((Date.now() - new Date(existing.last_contacted_at).getTime()) / 86400000)
        : null,
      priority: parsed.data.priority ?? existing.priority,
      hasNextFollowup: Boolean(existing.next_followup_at),
    });
    update.score = score.score;
  }

  const { error } = await supabase.from("leads").update(update).eq("id", id);
  if (error) return fail("Could not update the lead.");

  await writeAuditLog({
    action: "lead.updated",
    entity: "lead",
    entity_id: id,
    old_value: { status: existing.status, priority: existing.priority },
    new_value: update as unknown as Json,
    organization_id: ctx.orgId,
  });

  revalidatePath("/leads");
  revalidatePath(`/leads/${id}`);
  return ok();
}

export async function updateLeadStatus(id: string, status: string) {
  const ctx = await sessionOrg();
  if (!ctx) return fail("Not signed in.");
  const supabase = await createClient();
  const { data: existing } = await supabase.from("leads").select("status, next_followup_at").eq("id", id).maybeSingle();
  const { error } = await supabase
    .from("leads")
    .update({ status, updated_by: ctx.userId })
    .eq("id", id);
  if (error) return fail("Could not update status.");
  await writeAuditLog({
    action: "lead.status_changed",
    entity: "lead",
    entity_id: id,
    old_value: { status: existing?.status },
    new_value: { status },
    organization_id: ctx.orgId,
  });
  revalidatePath("/leads");
  revalidatePath(`/leads/${id}`);
  return ok();
}

export async function assignLeads(leadIds: string[], ownerId: string) {
  const parsed = assignLeadsSchema.safeParse({ leadIds, owner_id: ownerId });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Select leads and an owner.");
  const ctx = await sessionOrg();
  if (!ctx) return fail("Not signed in.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("leads")
    .update({ owner_id: parsed.data.owner_id, updated_by: ctx.userId })
    .in("id", parsed.data.leadIds);
  if (error) return fail("Could not reassign leads.");

  await writeAuditLog({
    action: "lead.bulk_assigned",
    entity: "lead",
    entity_id: null,
    new_value: { leadIds: parsed.data.leadIds, owner_id: parsed.data.owner_id },
    organization_id: ctx.orgId,
  });

  revalidatePath("/leads");
  return ok({ count: parsed.data.leadIds.length });
}

export async function mergeLeads(primaryId: string, duplicateId: string) {
  const ctx = await sessionOrg();
  if (!ctx) return fail("Not signed in.");
  const supabase = await createClient();

  const { data: dup } = await supabase.from("leads").select("*").eq("id", duplicateId).maybeSingle();
  if (!dup) return fail("Duplicate lead not found.");

  // Move activities and follow-ups to the primary lead, then soft-delete the duplicate.
  await supabase.from("activities").update({ entity_id: primaryId }).eq("entity_id", duplicateId).eq("entity_type", "lead");
  await supabase.from("followups").update({ entity_id: primaryId }).eq("entity_id", duplicateId).eq("entity_type", "lead");
  await supabase
    .from("leads")
    .update({ merged_into_id: primaryId, is_deleted: true, updated_by: ctx.userId })
    .eq("id", duplicateId);

  // Keep the richer mobile/email if the primary is missing them.
  const { data: primary } = await supabase.from("leads").select("*").eq("id", primaryId).maybeSingle();
  if (primary) {
    const patch: Record<string, unknown> = { updated_by: ctx.userId };
    if (!primary.mobile && dup.mobile) patch.mobile = dup.mobile;
    if (!primary.email && dup.email) patch.email = dup.email;
    if (!primary.whatsapp_number && dup.whatsapp_number) patch.whatsapp_number = dup.whatsapp_number;
    if (!primary.notes && dup.notes) patch.notes = dup.notes;
    if (Object.keys(patch).length > 1) {
      await supabase.from("leads").update(patch).eq("id", primaryId);
    }
  }

  await writeAuditLog({
    action: "lead.merged",
    entity: "lead",
    entity_id: primaryId,
    new_value: { merged_from: duplicateId },
    organization_id: ctx.orgId,
  });

  revalidatePath("/leads");
  return ok({ id: primaryId });
}

export async function convertLeadToCustomer(id: string) {
  const ctx = await sessionOrg();
  if (!ctx) return fail("Not signed in.");
  const supabase = await createClient();

  const { data: lead } = await supabase.from("leads").select("*").eq("id", id).maybeSingle();
  if (!lead) return fail("Lead not found.");
  if (lead.converted_customer_id) return fail("This lead has already been converted.");

  const { count } = await supabase
    .from("customers")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", ctx.orgId);

  const { data: customer, error } = await supabase
    .from("customers")
    .insert({
      organization_id: ctx.orgId,
      branch_id: lead.branch_id,
      customer_no: `CUS-${1000 + (count ?? 0) + 1}`,
      name: lead.name,
      company: lead.company,
      mobile: lead.mobile,
      email: lead.email,
      whatsapp_number: lead.whatsapp_number,
      address: lead.address,
      city: lead.city,
      state: lead.state,
      pincode: lead.pincode,
      assigned_to: lead.owner_id,
      created_by: ctx.userId,
    })
    .select()
    .single();
  if (error) return fail("Could not convert this lead.");

  await supabase
    .from("leads")
    .update({ converted_customer_id: customer.id, status: "WON", updated_by: ctx.userId })
    .eq("id", id);

  await supabase.from("activities").insert({
    organization_id: ctx.orgId,
    branch_id: lead.branch_id,
    entity_type: "lead",
    entity_id: id,
    activity_type: "system",
    summary: `Lead converted to customer ${customer.customer_no}`,
    created_by: ctx.userId,
  });

  await writeAuditLog({
    action: "lead.converted",
    entity: "lead",
    entity_id: id,
    new_value: { customer_id: customer.id },
    organization_id: ctx.orgId,
  });

  revalidatePath("/leads");
  revalidatePath(`/leads/${id}`);
  return ok({ customerId: customer.id });
}

export async function createCustomer(_prev: unknown, formData: FormData) {
  const parsed = createCustomerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the customer details.");
  const ctx = await sessionOrg();
  if (!ctx) return fail("Not signed in.");

  const supabase = await createClient();
  const { count } = await supabase
    .from("customers")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", ctx.orgId);

  const { data, error } = await supabase
    .from("customers")
    .insert({
      organization_id: ctx.orgId,
      branch_id: ctx.branchId,
      customer_no: `CUS-${1000 + (count ?? 0) + 1}`,
      ...parsed.data,
      assigned_to: ctx.userId,
      created_by: ctx.userId,
    })
    .select()
    .single();
  if (error) return fail("Could not create the customer.");

  await writeAuditLog({
    action: "customer.created",
    entity: "customer",
    entity_id: data.id,
    new_value: { name: data.name },
    organization_id: ctx.orgId,
  });

  revalidatePath("/customers");
  return ok({ id: data.id });
}

export async function scheduleFollowup(_prev: unknown, formData: FormData) {
  const parsed = createFollowupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the follow-up details.");
  const ctx = await sessionOrg();
  if (!ctx) return fail("Not signed in.");

  const supabase = await createClient();
  const dueAt = new Date(parsed.data.due_at);

  const { data, error } = await supabase
    .from("followups")
    .insert({
      organization_id: ctx.orgId,
      branch_id: ctx.branchId,
      entity_type: parsed.data.entity_type,
      entity_id: parsed.data.entity_id,
      kind: parsed.data.kind,
      subject: parsed.data.subject,
      due_at: dueAt.toISOString(),
      remind_at: parsed.data.remind_at ? new Date(parsed.data.remind_at).toISOString() : null,
      recurring_interval: parsed.data.recurring_interval ?? null,
      note: parsed.data.note ?? null,
      created_by: ctx.userId,
    })
    .select()
    .single();
  if (error) return fail("Could not schedule the follow-up.");

  // Keep the entity's next_followup_at in sync.
  if (parsed.data.entity_type === "lead") {
    await supabase
      .from("leads")
      .update({ next_followup_at: dueAt.toISOString(), updated_by: ctx.userId })
      .eq("id", parsed.data.entity_id);
  }

  await supabase.from("activities").insert({
    organization_id: ctx.orgId,
    branch_id: ctx.branchId,
    entity_type: parsed.data.entity_type,
    entity_id: parsed.data.entity_id,
    activity_type: "task",
    summary: `Follow-up scheduled (${parsed.data.kind}): ${parsed.data.subject}`,
    meta: { followup_id: data.id },
    created_by: ctx.userId,
  });

  await writeAuditLog({
    action: "followup.scheduled",
    entity: "followup",
    entity_id: data.id,
    new_value: { subject: data.subject, due_at: data.due_at },
    organization_id: ctx.orgId,
  });

  revalidatePath("/tasks");
  revalidatePath("/leads");
  return ok({ id: data.id });
}

export async function completeFollowup(id: string, note?: string) {
  const ctx = await sessionOrg();
  if (!ctx) return fail("Not signed in.");
  const supabase = await createClient();

  const { data: fup } = await supabase.from("followups").select("*").eq("id", id).maybeSingle();
  if (!fup) return fail("Follow-up not found.");

  const { error } = await supabase
    .from("followups")
    .update({ status: "DONE", completed_at: new Date().toISOString(), note: note ?? fup.note })
    .eq("id", id);
  if (error) return fail("Could not complete the follow-up.");

  await supabase.from("activities").insert({
    organization_id: ctx.orgId,
    branch_id: fup.branch_id,
    entity_type: fup.entity_type,
    entity_id: fup.entity_id,
    activity_type: "task",
    summary: `Follow-up completed: ${fup.subject}`,
    created_by: ctx.userId,
  });

  await writeAuditLog({
    action: "followup.completed",
    entity: "followup",
    entity_id: id,
    organization_id: ctx.orgId,
  });

  revalidatePath("/tasks");
  return ok();
}

export async function completeTask(id: string) {
  const ctx = await sessionOrg();
  if (!ctx) return fail("Not signed in.");
  const supabase = await createClient();

  const { data: task } = await supabase.from("tasks").select("*").eq("id", id).maybeSingle();
  if (!task) return fail("Task not found.");

  const { error } = await supabase
    .from("tasks")
    .update({ status: "DONE", completed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return fail("Could not complete the task.");

  await supabase.from("activities").insert({
    organization_id: ctx.orgId,
    branch_id: null,
    entity_type: task.entity_type ?? null,
    entity_id: task.entity_id,
    activity_type: "task",
    summary: `Task completed: ${task.subject}`,
    created_by: ctx.userId,
  });

  await writeAuditLog({
    action: "task.completed",
    entity: "task",
    entity_id: id,
    organization_id: ctx.orgId,
  });

  revalidatePath("/tasks");
  return ok();
}

export async function assignLead(id: string, ownerId: string) {
  const ctx = await sessionOrg();
  if (!ctx) return fail("Not signed in.");
  const supabase = await createClient();
  const { data: existing } = await supabase.from("leads").select("owner_id").eq("id", id).maybeSingle();
  const { error } = await supabase
    .from("leads")
    .update({ owner_id: ownerId, updated_by: ctx.userId })
    .eq("id", id);
  if (error) return fail("Could not reassign the lead.");
  await writeAuditLog({
    action: "lead.reassigned",
    entity: "lead",
    entity_id: id,
    old_value: { owner_id: existing?.owner_id ?? null },
    new_value: { owner_id: ownerId },
    organization_id: ctx.orgId,
  });
  revalidatePath("/leads");
  revalidatePath(`/leads/${id}`);
  return ok();
}

export async function sendMessageAction(
  entity_type: string,
  entity_id: string,
  channel: "whatsapp" | "email" | "sms",
  body: string
) {
  if (!body.trim()) return fail("Message cannot be empty.");
  const ctx = await sessionOrg();
  if (!ctx) return fail("Not signed in.");

  const supabase = await createClient();
  let recipient: string | null = null;
  if (entity_type === "lead") {
    const { data } = await supabase.from("leads").select("mobile, whatsapp_number, email").eq("id", entity_id).maybeSingle();
    recipient = channel === "email" ? (data?.email ?? null) : (data?.whatsapp_number ?? data?.mobile ?? null);
  } else if (entity_type === "customer") {
    const { data } = await supabase.from("customers").select("mobile, whatsapp_number, email, opt_in_comms").eq("id", entity_id).maybeSingle();
    if (channel !== "email" && data && data.opt_in_comms === false) {
      return fail("This customer has not opted in to WhatsApp marketing. Respect their preference.");
    }
    recipient = channel === "email" ? (data?.email ?? null) : (data?.whatsapp_number ?? data?.mobile ?? null);
  }
  if (!recipient) return fail("No contact number or email is available for this record.");

  const { sendAndRecord } = await import("@/lib/providers/notification");
  const result = await sendAndRecord(
    {
      channel,
      to: recipient,
      body,
      entity_type,
      entity_id,
    },
    { organizationId: ctx.orgId, createdBy: ctx.userId }
  );

  await supabase.from("activities").insert({
    organization_id: ctx.orgId,
    branch_id: ctx.branchId,
    entity_type: entity_type as never,
    entity_id,
    activity_type: channel === "email" ? "email" : "whatsapp",
    direction: "out",
    summary: `${channel.toUpperCase()} sent: ${body.slice(0, 120)}`,
    created_by: ctx.userId,
  });

  await writeAuditLog({
    action: "message.sent",
    entity: "message",
    entity_id: null,
    new_value: { channel, entity_type, entity_id, ok: result.ok },
    organization_id: ctx.orgId,
  });

  revalidatePath(`/leads/${entity_id}`);
  return ok({ status: result.status });
}

export async function logActivity(_prev: unknown, formData: FormData) {
  const parsed = logActivitySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the activity details.");
  const ctx = await sessionOrg();
  if (!ctx) return fail("Not signed in.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activities")
    .insert({
      organization_id: ctx.orgId,
      branch_id: ctx.branchId,
      entity_type: parsed.data.entity_type,
      entity_id: parsed.data.entity_id,
      activity_type: parsed.data.activity_type,
      direction: parsed.data.direction ?? "out",
      summary: parsed.data.summary,
      meta: parsed.data.meta,
      created_by: ctx.userId,
    })
    .select()
    .single();
  if (error) return fail("Could not log the activity.");

  // Touch last_contacted_at on the linked lead.
  if (parsed.data.entity_type === "lead") {
    await supabase
      .from("leads")
      .update({ last_contacted_at: new Date().toISOString(), updated_by: ctx.userId })
      .eq("id", parsed.data.entity_id);
  }

  await writeAuditLog({
    action: `activity.logged`,
    entity: "activity",
    entity_id: data.id,
    new_value: { activity_type: data.activity_type },
    organization_id: ctx.orgId,
  });

  revalidatePath("/activities");
  return ok();
}

export async function createVisit(_prev: unknown, formData: FormData) {
  const parsed = createVisitSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the visit details.");
  const ctx = await sessionOrg();
  if (!ctx) return fail("Not signed in.");

  const supabase = await createClient();
  const scheduledAt = new Date(parsed.data.scheduled_at);

  const { data, error } = await supabase
    .from("visits")
    .insert({
      organization_id: ctx.orgId,
      branch_id: ctx.branchId,
      customer_id: parsed.data.customer_id,
      purpose: parsed.data.purpose,
      scheduled_at: scheduledAt.toISOString(),
      status: "PLANNED",
      visit_by: ctx.userId,
      created_by: ctx.userId,
    })
    .select()
    .single();
  if (error) return fail("Could not schedule the visit.");

  await supabase.from("activities").insert({
    organization_id: ctx.orgId,
    branch_id: ctx.branchId,
    entity_type: "visit",
    entity_id: data.id,
    activity_type: "visit",
    summary: `Visit scheduled: ${parsed.data.purpose}`,
    created_by: ctx.userId,
  });

  await writeAuditLog({
    action: "visit.created",
    entity: "visit",
    entity_id: data.id,
    new_value: { purpose: parsed.data.purpose, scheduled_at: scheduledAt.toISOString() },
    organization_id: ctx.orgId,
  });

  revalidatePath("/visits");
  return ok({ id: data.id });
}