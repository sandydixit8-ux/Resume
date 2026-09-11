"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit";
import {
  onboardingBusinessSchema,
  onboardingBranchSchema,
  inviteUserSchema,
} from "@/lib/validators";
import { seedDemoData } from "@/lib/seed-demo";

async function currentUserId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

function actionError(message: string) {
  return { success: false as const, error: message };
}

/** Step 1 — create the business, make the caller the owner, bootstrap defaults. */
export async function createBusiness(_prev: unknown, formData: FormData) {
  const parsed = onboardingBusinessSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Invalid business details");
  }
  const userId = await currentUserId();
  if (!userId) return actionError("You need to be signed in.");

  const { name, industry, legal_name, gstin } = parsed.data;

  try {
    const admin = createAdminClient();

    const { data: org, error: orgError } = await admin
      .from("organizations")
      .insert({
        name,
        industry,
        legal_name: legal_name || null,
        gstin: gstin || null,
      })
      .select()
      .single();
    if (orgError) throw orgError;

    await admin.rpc("bootstrap_organization", { p_org: org.id });

    const { error: updateErr } = await admin
      .from("users")
      .update({ organization_id: org.id, org_scope: "org" })
      .eq("id", userId);
    if (updateErr) throw updateErr;

    const { data: ownerRole } = await admin
      .from("roles")
      .select("id")
      .eq("organization_id", org.id)
      .eq("slug", "BUSINESS_OWNER")
      .maybeSingle();
    if (ownerRole) {
      await admin.from("user_roles").insert({
        user_id: userId,
        role_id: ownerRole.id,
        organization_id: org.id,
      });
    }

    const { data: freePlan } = await admin.from("plans").select("id").eq("slug", "FREE").maybeSingle();
    await admin.from("subscriptions").insert({
      organization_id: org.id,
      plan_id: freePlan?.id ?? null,
      status: "TRIAL",
    });

    await writeAuditLog({
      action: "organization.created",
      entity: "organization",
      entity_id: org.id,
      new_value: { name, industry },
      organization_id: org.id,
    });
  } catch (err) {
    console.error("createBusiness failed", err);
    return actionError("Unable to create your business. Please try again.");
  }

  revalidatePath("/onboarding", "layout");
  redirect("/onboarding/branch");
}

/** Step 2 — create the first branch. */
export async function createBranch(_prev: unknown, formData: FormData) {
  const parsed = onboardingBranchSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Invalid branch details");
  }
  const userId = await currentUserId();
  if (!userId) return actionError("You need to be signed in.");

  try {
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("users")
      .select("organization_id")
      .eq("id", userId)
      .maybeSingle();
    if (!profile?.organization_id) return actionError("Create your business first.");

    const { data: branch } = await admin
      .from("branches")
      .insert({
        organization_id: profile.organization_id,
        name: parsed.data.name,
        address: parsed.data.address || null,
        city: parsed.data.city || null,
        state: parsed.data.state || null,
        pincode: parsed.data.pincode || null,
      })
      .select()
      .single();

    if (branch) {
      await admin.from("user_branches").insert({
        user_id: userId,
        branch_id: branch.id,
        organization_id: profile.organization_id,
      });
    }

    await writeAuditLog({
      action: "branch.created",
      entity: "branch",
      entity_id: branch?.id,
      new_value: { name: parsed.data.name },
      organization_id: profile.organization_id,
    });
  } catch (err) {
    console.error("createBranch failed", err);
    return actionError("Unable to create the branch.");
  }

  redirect("/onboarding/team");
}

/** Step 3 — invite teammates (optional). Adds invitations; a later phase wires acceptance. */
export async function inviteTeammates(_prev: unknown, formData: FormData) {
  const userId = await currentUserId();
  if (!userId) return actionError("You need to be signed in.");

  const raw = formData.get("email") ? [formData.get("email")] : [];

  try {
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("users")
      .select("organization_id")
      .eq("id", userId)
      .maybeSingle();
    if (!profile?.organization_id) return actionError("Create your business first.");

    for (const email of raw) {
      const parsed = inviteUserSchema.safeParse({
        email: String(email),
        role_slug: "SALES_EXECUTIVE",
        branch_ids: [],
      });
      if (!parsed.success) continue;
      await admin.from("invitations").insert({
        organization_id: profile.organization_id,
        email: parsed.data.email,
        role_slug: parsed.data.role_slug,
        token: crypto.randomUUID().replaceAll("-", "").slice(0, 24),
        created_by: userId,
      });
    }
  } catch (err) {
    console.error("inviteTeammates failed", err);
  }

  redirect("/onboarding/products");
}

export async function skipToProducts() {
  redirect("/onboarding/products");
}

/** Step 4 — create a few products or load realistic sample data. */
export async function createSampleProducts(_prev: unknown, formData: FormData) {
  const offline = String(formData.get("sample") ?? "yes") === "yes";
  const userId = await currentUserId();
  if (!userId) return actionError("You need to be signed in.");

  try {
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("users")
      .select("organization_id")
      .eq("id", userId)
      .maybeSingle();
    if (!profile?.organization_id) return actionError("Create your business first.");

    if (offline) {
      await seedDemoData(profile.organization_id, userId, admin);
    }
  } catch (err) {
    console.error("createSampleProducts failed", err);
    return actionError("Could not load sample data.");
  }

  redirect("/onboarding/complete");
}