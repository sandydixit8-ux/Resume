import { all, row, run, newId, nowIso } from "@/lib/db/db";
import { audit } from "@/lib/audit";
import { PLANS } from "@/lib/plans";

export interface AdminOrg {
  id: string;
  name: string;
  slug: string;
  plan: string;
  members: number;
  created_at: string;
}

export interface AdminFlag {
  id: string;
  flag: string;
  enabled: boolean;
}

export interface AdminTicket {
  id: string;
  subject: string;
  body: string;
  status: string;
  created_at: string;
  email?: string;
}

export const VALID_TICKET_STATUSES = ["open", "pending", "resolved", "closed"];

export function listOrgs(): AdminOrg[] {
  return all<AdminOrg>(
    `SELECT o.id, o.name, o.slug, o.plan, o.created_at,
            (SELECT COUNT(*) FROM memberships m WHERE m.tenant_id = o.id) AS members
     FROM organizations o ORDER BY o.created_at DESC`
  );
}

export function setOrgPlan(adminUserId: string, orgId: string, plan: string): { ok: boolean } {
  if (!(plan in PLANS)) throw new Error("invalid_plan");
  const org = row<{ id: string; plan: string }>("SELECT id, plan FROM organizations WHERE id = ?", orgId);
  if (!org) throw new Error("org_not_found");
  run("UPDATE organizations SET plan = ?, updated_at = ? WHERE id = ?", plan, nowIso(), orgId);
  audit({ tenantId: orgId, userId: adminUserId, action: "admin.plan_change", resource: orgId, meta: { from: org.plan, to: plan } });
  return { ok: true };
}

export function planCursor(): string[] {
  return Object.keys(PLANS);
}

export function listFlags(): AdminFlag[] {
  return all<AdminFlag>("SELECT id, flag, enabled FROM feature_flags ORDER BY flag").map((f) => ({ ...f, enabled: !!f.enabled }));
}

export function checkFlag(flag: string): boolean {
  const r = row<{ enabled: number }>("SELECT enabled FROM feature_flags WHERE flag = ?", flag);
  return r === undefined ? true : !!r.enabled;
}

export function setFlag(adminUserId: string, flag: string, enabled: boolean): { ok: boolean } {
  const existing = row<{ id: string }>("SELECT id FROM feature_flags WHERE flag = ?", flag);
  if (existing) {
    run("UPDATE feature_flags SET enabled = ? WHERE id = ?", enabled ? 1 : 0, existing.id);
  } else {
    run("INSERT INTO feature_flags (id, flag, enabled) VALUES (?, ?, ?)", newId("flg"), flag, enabled ? 1 : 0);
  }
  audit({ tenantId: "_platform", userId: adminUserId, action: "admin.flag_change", resource: flag, meta: { enabled } });
  return { ok: true };
}

export function listOpenTickets(): AdminTicket[] {
  return all<AdminTicket>(
    `SELECT t.id, t.subject, t.body, t.status, t.created_at, u.email
     FROM support_tickets t LEFT JOIN users u ON u.id = t.user_id
     WHERE t.status IN ('open', 'pending') ORDER BY t.created_at DESC LIMIT 200`
  );
}

export function updateTicketStatus(adminUserId: string, id: string, status: string): { ok: boolean } {
  if (!VALID_TICKET_STATUSES.includes(status)) throw new Error("invalid_status");
  const found = row<{ id: string }>("SELECT id FROM support_tickets WHERE id = ?", id);
  if (!found) throw new Error("ticket_not_found");
  run("UPDATE support_tickets SET status = ? WHERE id = ?", status, id);
  audit({ tenantId: "_platform", userId: adminUserId, action: "admin.ticket_update", resource: id, meta: { status } });
  return { ok: true };
}