import { all, run, row, tx, nowIso } from "@/lib/db/db";

// Tenant-scoped tables (all carry tenant_id) exported for data portability.
const TENANT_TABLES = [
  "memberships",
  "subscriptions",
  "plans_usage",
  "profiles",
  "bio_pages",
  "bio_blocks",
  "products",
  "services",
  "availability_windows",
  "contacts",
  "bookings",
  "analytics_events",
  "email_lists",
  "email_list_members",
  "email_templates",
  "email_campaigns",
  "email_sends",
  "unsubscribes",
  "communities",
  "posts",
  "automation_workflows",
  "notifications",
  "payments",
  "orders",
  "order_items",
  "courses",
  "course_sections",
  "lessons",
  "enrollments",
  "lesson_progress",
  "audit_logs",
  "support_tickets",
];

export type AccountExport = Record<string, unknown>;

export function exportAccountData(tenantId: string, userId: string): AccountExport {
  const data: AccountExport = { exportedAt: nowIso() };
  data.organization = row(
    "SELECT id, name, slug, plan, trial_ends, settings, created_at, updated_at FROM organizations WHERE id = ?",
    tenantId
  );
  data.user = row(
    "SELECT id, email, name, role, email_verified, created_at, updated_at FROM users WHERE id = ?",
    userId
  );
  for (const table of TENANT_TABLES) {
    data[table] = all(`SELECT * FROM ${table} WHERE tenant_id = ?`, tenantId);
  }
  return data;
}

export function deleteAccountData(tenantId: string, userId: string): void {
  tx(() => {
    // Tables without a tenant FK cascade are scrubbed manually first.
    run("DELETE FROM audit_logs WHERE tenant_id = ? OR user_id = ?", tenantId, userId);
    run("DELETE FROM support_tickets WHERE tenant_id = ? OR user_id = ?", tenantId, userId);
    run("DELETE FROM sessions WHERE user_id = ?", userId);
    run("DELETE FROM memberships WHERE tenant_id = ?", tenantId);
    // organizations cascades to every tenant table (ON DELETE CASCADE).
    run("DELETE FROM organizations WHERE id = ?", tenantId);
    // users cascades notifications / profiles / memberships not already gone.
    run("DELETE FROM users WHERE id = ?", userId);
  });
}