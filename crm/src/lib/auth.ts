import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AppUser, Branch, Organization } from "@/types/supabase";

export interface UserContext {
  user: AppUser | null;
  organization: Organization | null;
  branches: Branch[];
  roleSlugs: string[];
  permissions: string[];
  isAuthenticated: boolean;
}

export async function getSession() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

/** Current signed-in user's app profile (null when not found). */
export async function getAppUser() {
  const { supabase, user } = await getSession();
  if (!user) return null;
  const { data } = await supabase.from("users").select("*").eq("id", user.id).maybeSingle();
  return (data as AppUser | null) ?? null;
}

/** Full context used across layouts/pages/server actions. */
export async function getUserContext(): Promise<UserContext> {
  const { supabase, user } = await getSession();

  const empty: UserContext = {
    user: null,
    organization: null,
    branches: [],
    roleSlugs: [],
    permissions: [],
    isAuthenticated: Boolean(user),
  };
  if (!user) return empty;

  const appUser = await getAppUser();
  if (!appUser) return empty;

  const [orgRes, branchRes, rolesRes, permsRes] = await Promise.all([
    supabase.from("organizations").select("*").eq("id", appUser.organization_id ?? "").maybeSingle(),
    supabase
      .from("branches")
      .select("*")
      .eq("organization_id", appUser.organization_id ?? "")
      .order("name"),
    supabase
      .from("user_roles")
      .select("roles (slug)")
      .eq("user_id", user.id)
      .eq("organization_id", appUser.organization_id ?? ""),
    supabase
      .from("role_permissions")
      .select("permissions (slug)")
      .eq("organization_id", appUser.organization_id ?? ""),
  ]);

  const ownRoleIds = rolesRes.data?.map((r) => (r as unknown as { roles: { slug: string } | null }).roles?.slug ?? "") ?? [];
  const roleSlugs = ownRoleIds.filter(Boolean);

  const allPerms = permsRes.data ?? [];
  const permissions = [
    ...new Set(
      allPerms
        .map((p) => (p as unknown as { permissions: { slug: string } | null }).permissions?.slug ?? "")
        .filter(Boolean)
    ),
  ];

  if (roleSlugs.includes("BUSINESS_OWNER") || roleSlugs.includes("ADMIN")) {
    // Owners/admins hold all permissions; flagged in the seed via role_permissions
    // for everyone above, but the explicit org-wide list is included here too.
  }

  return {
    user: appUser,
    organization: (orgRes.data as Organization | null) ?? null,
    branches: (branchRes.data as Branch[] | null) ?? [],
    roleSlugs,
    permissions,
    isAuthenticated: true,
  };
}

/** Require an authenticated session for pages or raise the user back to /login. */
export async function requireUser() {
  const { supabase } = await getSession();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return user;
}

/** Redirect signed-in users away from auth pages. */
export async function requireGuest() {
  const { supabase } = await getSession();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const appUser = await getAppUser();
    redirect(appUser?.organization_id ? "/" : "/onboarding/business");
  }
}

export function hasPermission(ctx: Pick<UserContext, "permissions">, slug: string): boolean {
  return ctx.permissions.includes(slug);
}

export function hasAnyPermission(ctx: Pick<UserContext, "permissions">, slugs: string[]): boolean {
  return slugs.some((s) => hasPermission(ctx, s));
}