import { FREE_AUDIT_RETENTION_DAYS, nowIso, run, row } from "@/lib/db/db";

/**
 * Free-audit retention.
 *
 * Anonymous free audits store an email address and an IP address. That is
 * personal data, and without a deletion deadline it accumulates forever. The
 * deadline is set at insert time (so a forgotten row cannot become
 * undeletable) and enforced by a cleanup pass.
 *
 * `FREE_AUDIT_RETENTION_DAYS` is policy, not code: it is read from the
 * environment so compliance can change the window without a deploy.
 */

export function retentionDeadline(from: Date = new Date()): string {
  return new Date(from.getTime() + FREE_AUDIT_RETENTION_DAYS * 86_400_000).toISOString();
}

export interface PurgeResult {
  deleted: number;
  scanned: number;
  retentionDays: number;
}

/**
 * Deletes expired free audits.
 *
 * Scoped strictly to `free_audits`: no paid or customer data can be reached
 * from here, so a mistake in the retention config cannot delete a customer's
 * reports. Batched, because a large backlog in one statement holds a write lock
 * for the whole table.
 */
export function purgeExpiredFreeAudits(batchSize = 500): PurgeResult {
  const now = nowIso();
  const info = run(
    `DELETE FROM free_audits
     WHERE id IN (
       SELECT id FROM free_audits
       WHERE expires_at IS NOT NULL AND expires_at <= ?
       ORDER BY expires_at ASC
       LIMIT ?
     )`,
    now,
    batchSize
  );
  const remaining = row<{ n: number }>(
    "SELECT COUNT(*) AS n FROM free_audits WHERE expires_at IS NOT NULL AND expires_at <= ?",
    now
  );
  return {
    deleted: info.changes,
    scanned: remaining?.n ?? 0,
    retentionDays: FREE_AUDIT_RETENTION_DAYS,
  };
}

export function expiredFreeAuditCount(): number {
  return (
    row<{ n: number }>(
      "SELECT COUNT(*) AS n FROM free_audits WHERE expires_at IS NOT NULL AND expires_at <= ?",
      nowIso()
    )?.n ?? 0
  );
}
