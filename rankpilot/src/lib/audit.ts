import { newId, nowIso, run } from "@/lib/db/db";

export interface AuditEntry {
  tenantId?: string | null;
  userId?: string | null;
  action: string;
  entity?: string;
  entityId?: string;
  meta?: Record<string, unknown>;
  ip?: string | null;
}

export function audit(entry: AuditEntry): void {
  try {
    run(
      `INSERT INTO audit_logs (id, tenant_id, user_id, action, entity, entity_id, meta, ip, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      newId("log"),
      entry.tenantId ?? null,
      entry.userId ?? null,
      entry.action,
      entry.entity ?? null,
      entry.entityId ?? null,
      JSON.stringify(entry.meta ?? {}),
      entry.ip ?? null,
      nowIso()
    );
  } catch {
    // auditing must never break the main flow
  }
}
