import { newId, nowIso, run } from "@/lib/db/db";

export interface AuditInput {
  tenantId?: string;
  userId?: string;
  action: string;
  resource?: string;
  meta?: Record<string, unknown>;
  ip?: string;
}

export function audit(input: AuditInput) {
  try {
    run(
      "INSERT INTO audit_logs (id, tenant_id, user_id, action, resource, meta, ip, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      newId("aud"),
      input.tenantId ?? null,
      input.userId ?? null,
      input.action,
      input.resource ?? "",
      JSON.stringify(input.meta ?? {}),
      input.ip ?? "",
      nowIso()
    );
  } catch {
    // audit writes must never break the request
  }
}