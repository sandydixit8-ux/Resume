import { all, row, run, newId, nowIso } from "@/lib/db/db";

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
}

export function createNotification(tenantId: string, userId: string, title: string, body = ""): void {
  run(
    "INSERT INTO notifications (id, tenant_id, user_id, title, body, read_flag, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)",
    newId("ntf"),
    tenantId,
    userId,
    title,
    body,
    nowIso()
  );
}

export function listNotifications(tenantId: string, userId: string, limit = 50): AppNotification[] {
  return all<AppNotification>(
    "SELECT id, title, body, read_flag AS read, created_at FROM notifications WHERE tenant_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT ?",
    tenantId,
    userId,
    limit
  ).map((n) => ({ ...n, read: !!n.read }));
}

export function unreadCount(tenantId: string, userId: string): number {
  return (row<{ c: number }>("SELECT COUNT(*) AS c FROM notifications WHERE tenant_id = ? AND user_id = ? AND read_flag = 0", tenantId, userId) as { c: number }).c;
}

export function markNotificationRead(tenantId: string, userId: string, id: string): boolean {
  const updated = run(
    "UPDATE notifications SET read_flag = 1 WHERE id = ? AND tenant_id = ? AND user_id = ?",
    id,
    tenantId,
    userId
  );
  return updated.changes > 0;
}

export function markAllRead(tenantId: string, userId: string): number {
  return run(
    "UPDATE notifications SET read_flag = 1 WHERE tenant_id = ? AND user_id = ? AND read_flag = 0",
    tenantId,
    userId
  ).changes;
}