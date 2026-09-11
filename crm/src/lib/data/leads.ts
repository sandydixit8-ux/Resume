import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Lead, UserRole } from "@/types/supabase";

export interface LeadListParams {
  page?: number;
  pageSize?: number;
  status?: string;
  priority?: string;
  source?: string;
  owner?: string;
  branch?: string;
  q?: string;
  sort?: string;
}

export interface LeadListResult {
  leads: Lead[];
  total: number;
  page: number;
  pageSize: number;
  ownerNames: Record<string, string>;
}

export async function listLeads(params: LeadListParams = {}): Promise<LeadListResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const page = params.page ?? 1;
  const pageSize = Math.min(params.pageSize ?? 20, 100);

  let query = supabase
    .from("leads")
    .select("*", { count: "exact" })
    .eq("is_deleted", false);

  if (params.status) query = query.eq("status", params.status as Lead["status"]);
  if (params.priority) query = query.eq("priority", params.priority as Lead["priority"]);
  if (params.source) query = query.eq("source", params.source);
  if (params.owner) query = query.eq("owner_id", params.owner);
  if (params.branch) query = query.eq("branch_id", params.branch);
  if (params.q) query = query.or(`name.ilike.%${params.q}%,company.ilike.%${params.q}%,mobile.ilike.%${params.q}%,email.ilike.%${params.q}%`);

  const orderCol = params.sort && params.sort.startsWith("-") ? params.sort.slice(1) : (params.sort ?? "created_at");
  const asc = params.sort?.startsWith("-") ? false : true;
  query = query.order(orderCol, { ascending: asc });

  const { data, count, error } = await query.range((page - 1) * pageSize, page * pageSize - 1);
  if (error) throw new Error(error.message);

  const ownerIds = [...new Set((data ?? []).map((l) => l.owner_id).filter(Boolean))] as string[];
  const ownerNames: Record<string, string> = {};
  if (ownerIds.length && user) {
    const { data: users } = await supabase
      .from("users")
      .select("id, full_name")
      .in("id", ownerIds);
    (users ?? []).forEach((u) => {
      ownerNames[u.id] = u.full_name;
    });
  }

  return {
    leads: (data ?? []) as Lead[],
    total: count ?? 0,
    page,
    pageSize,
    ownerNames,
  };
}

export async function getLead(id: string): Promise<Lead | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("leads").select("*").eq("id", id).maybeSingle();
  return (data as Lead | null) ?? null;
}

export async function getLeadSources(): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("lead_sources").select("name").order("name");
  return (data ?? []).map((r) => r.name);
}

export async function getAssignableUsers(): Promise<{ id: string; full_name: string; email: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("users").select("id, full_name, email").order("full_name");
  return (data ?? []) as { id: string; full_name: string; email: string }[];
}

export async function getCurrentUserRoles(): Promise<string[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("user_roles")
    .select("roles (slug)")
    .eq("user_id", user.id);
  return (data ?? [])
    .map((r) => (r as unknown as { roles: { slug: string } | null }).roles?.slug ?? "")
    .filter(Boolean);
}