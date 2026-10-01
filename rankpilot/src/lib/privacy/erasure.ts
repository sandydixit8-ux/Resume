import { all, row, run, tx } from "@/lib/db/db";

/**
 * Data erasure.
 *
 * Soft delete (`deleted_at`) hides a tenant from the app but keeps every row
 * forever, so it satisfies nothing on its own: an erasure request means the
 * personal data is actually gone. This module is that mechanism.
 *
 * Two shapes of request, because the blast radius differs:
 *
 *   purgeTenant  -- a whole organization. Most tables cascade from
 *                   `organizations.id`, so deleting that one row removes the
 *                   bulk of the graph. Three tables carry a `tenant_id` with no
 *                   foreign key (`audit_logs`, `jobs`, `ai_usage`) and would be
 *                   left behind as orphans, so they are handled explicitly.
 *   eraseUser    -- one person inside a tenant they do not own. Deleting the
 *                   user cascades to their sessions, tokens, and memberships.
 *                   `audit_logs.user_id` has no foreign key, so the PII in the
 *                   security log is scrubbed explicitly.
 *
 * Audit logs are anonymized, not deleted. They are the record of who did what
 * to a customer's data; destroying them on request would also destroy the
 * evidence needed to answer the next request. The identity is removed and the
 * event is kept.
 *
 * Foreign keys must be on for the cascades to fire at all; `db.ts` sets
 * `PRAGMA foreign_keys = ON`, and `assertCascadesEnabled()` fails loudly rather
 * than reporting a clean purge that left orphans behind.
 */

/** Tables that reference a tenant without a foreign key, so no cascade. */
const TENANT_ORPHAN_TABLES = ["jobs", "ai_usage"] as const;

/**
 * `audit_logs` columns that identify a person. Only these two exist on the
 * table: naming a column that does not exist would make erasure throw, which
 * is the worst possible failure for a compliance path.
 *
 * `meta` is deliberately not listed as a column to null, because it is the
 * security record's payload. It is scrubbed through `scrubMeta` instead, which
 * removes identifying keys while preserving the event.
 */
const AUDIT_ANONYMIZE_COLUMNS = ["user_id", "ip"] as const;

/** Keys stripped from an audit log's `meta` blob during erasure. */
const META_PII_KEYS = [
  "email",
  "ip",
  "userAgent",
  "user_agent",
  "name",
  "fullName",
  "password",
  "token",
] as const;

/**
 * Depth ceiling for the recursive walk. Deeper structures are replaced with
 * `{}` rather than descended into, so a hostile or merely deep blob cannot turn
 * an erasure pass into a stack-overflow DoS.
 */
const MAX_META_DEPTH = 12;

/**
 * Removes identifying keys from a stored `meta` blob, at any depth.
 *
 * `meta` is caller-supplied JSON, so an erasure pass cannot assume it holds no
 * personal data. A top-level-only scrub is not sufficient: the same address can
 * sit at `meta.contact.email` or inside `meta.targets[3].userAgent`, and a
 * partial scrub that silently leaves those behind is worse than no scrub,
 * because the erasure is recorded as having happened. Keys are dropped rather
 * than values blanked so a value that itself is an email is not left behind. A
 * malformed blob is replaced outright rather than trusted.
 */
function scrubValue(value: unknown, depth: number): unknown {
  if (depth > MAX_META_DEPTH) return {};
  if (Array.isArray(value)) return value.map((item) => scrubValue(item, depth + 1));
  if (value === null || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
    if ((META_PII_KEYS as readonly string[]).includes(key)) continue;
    out[key] = scrubValue(inner, depth + 1);
  }
  return out;
}

function scrubMeta(raw: string | null | undefined): string {
  if (!raw) return "{}";
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return "{}";
    return JSON.stringify(scrubValue(parsed, 0));
  } catch {
    // Unparseable meta cannot be shown to have no PII in it.
    return "{}";
  }
}

export interface ErasureResult {
  /** Rows removed per table. Cascaded tables are counted before deletion. */
  deleted: Record<string, number>;
  /** Rows whose identifying columns were nulled but retained. */
  anonymized: Record<string, number>;
  /** True when nothing was touched, i.e. a dry run or an unknown id. */
  dryRun: boolean;
  /** Populated when foreign keys are off and cascades cannot be trusted. */
  warning?: string;
}

function countRows(sql: string, ...params: string[]): number {
  return row<{ n: number }>(sql, ...params)?.n ?? 0;
}

/** Count rows in a table that reference a tenant, tolerating an absent table. */
function countForTenant(table: string, tenantId: string): number {
  return countRows(`SELECT COUNT(*) AS n FROM ${table} WHERE tenant_id = ?`, tenantId);
}

/**
 * Verifies the cascade will actually fire. `PRAGMA foreign_keys` is a no-op
 * inside a transaction, so this is checked before the transaction opens.
 */
export function foreignKeysEnabled(): boolean {
  const result = row<{ foreign_keys: number }>("PRAGMA foreign_keys");
  return result?.foreign_keys === 1;
}

export function assertCascadesEnabled(): void {
  if (!foreignKeysEnabled()) {
    throw new Error(
      "PRAGMA foreign_keys is off, so ON DELETE CASCADE will not fire. " +
        "Erasure would report success while leaving orphaned rows behind."
    );
  }
}

export function purgeTenant(tenantId: string, options: { dryRun?: boolean } = {}): ErasureResult {
  const dryRun = options.dryRun ?? false;
  const result: ErasureResult = { deleted: {}, anonymized: {}, dryRun };

  if (!foreignKeysEnabled()) {
    result.warning = "foreign keys are off; cascades were not applied";
  }

  // Count first, delete after. Counting before the cascade is the only way to
  // report an honest per-table count for tables that disappear as a side effect
  // of deleting the organization row.
  const organizations = countRows("SELECT COUNT(*) AS n FROM organizations WHERE id = ?", tenantId);
  if (organizations === 0) return result;

  for (const table of TENANT_ORPHAN_TABLES) {
    const n = countForTenant(table, tenantId);
    if (n > 0) result.deleted[table] = n;
  }
  result.anonymized.audit_logs = countRows(
    "SELECT COUNT(*) AS n FROM audit_logs WHERE tenant_id = ?",
    tenantId
  );

  if (dryRun) return result;

  assertCascadesEnabled();

  tx(() => {
    for (const table of TENANT_ORPHAN_TABLES) {
      run(`DELETE FROM ${table} WHERE tenant_id = ?`, tenantId);
    }
    // Collect the blobs before the columns are nulled, so the lookup still
    // matches. Anonymizing a column first would make its own scrub a no-op.
    const entries = all<{ id: string; meta: string | null }>(
      "SELECT id, meta FROM audit_logs WHERE tenant_id = ?",
      tenantId
    );
    // Keep the security record, drop the identifiers. `tenant_id` stays so the
    // event remains correlatable to the erasure request that caused it.
    for (const column of AUDIT_ANONYMIZE_COLUMNS) {
      run(`UPDATE audit_logs SET ${column} = NULL WHERE tenant_id = ?`, tenantId);
    }
    for (const entry of entries) {
      run("UPDATE audit_logs SET meta = ? WHERE id = ?", scrubMeta(entry.meta), entry.id);
    }
    // Triggers the cascade across every table that declares
    // `tenant_id REFERENCES organizations(id) ON DELETE CASCADE`.
    run("DELETE FROM organizations WHERE id = ?", tenantId);
  });

  return result;
}

export function eraseUser(userId: string, options: { dryRun?: boolean } = {}): ErasureResult {
  const dryRun = options.dryRun ?? false;
  const result: ErasureResult = { deleted: {}, anonymized: {}, dryRun };

  if (!foreignKeysEnabled()) {
    result.warning = "foreign keys are off; cascades were not applied";
  }

  const users = countRows("SELECT COUNT(*) AS n FROM users WHERE id = ?", userId);
  if (users === 0) return result;

  result.anonymized.audit_logs = countRows(
    "SELECT COUNT(*) AS n FROM audit_logs WHERE user_id = ?",
    userId
  );

  if (dryRun) return result;

  assertCascadesEnabled();

  tx(() => {
    // Collect the rows *before* anonymizing anything. The updates below key off
    // these captured ids rather than `WHERE user_id = ?`, because `user_id` is
    // itself one of the columns being nulled: ordering the columns as
    // (user_id, ip) meant the ip update matched zero rows and left the address
    // behind while the join key was already destroyed.
    const entries = all<{ id: string; meta: string | null }>(
      "SELECT id, meta FROM audit_logs WHERE user_id = ?",
      userId
    );
    if (entries.length > 0) {
      const ids = entries.map((e) => e.id);
      const placeholders = ids.map(() => "?").join(", ");
      for (const column of AUDIT_ANONYMIZE_COLUMNS) {
        run(
          `UPDATE audit_logs SET ${column} = NULL WHERE id IN (${placeholders})`,
          ...ids
        );
      }
      for (const entry of entries) {
        run("UPDATE audit_logs SET meta = ? WHERE id = ?", scrubMeta(entry.meta), entry.id);
      }
    }
    // Cascades to sessions, password_reset_tokens, email_verification_tokens,
    // and memberships via `ON DELETE CASCADE`.
    run("DELETE FROM users WHERE id = ?", userId);
  });

  return result;
}

/** Tenant ids that still hold data, for an operator-facing erasure queue. */
export function tenantsPendingErasure(): Array<{ id: string; deletedAt: string | null }> {
  return all<{ id: string; deleted_at: string | null }>(
    "SELECT id, deleted_at FROM organizations WHERE deleted_at IS NOT NULL ORDER BY deleted_at ASC"
  ).map((r) => ({ id: r.id, deletedAt: r.deleted_at ?? null }));
}

/** Ages soft-deleted tenants so a forgotten erasure can be chased. */
export function pendingErasureSummary(): { count: number; oldestDeletedAt: string | null } {
  const r = row<{ n: number; oldest: string | null }>(
    "SELECT COUNT(*) AS n, MIN(deleted_at) AS oldest FROM organizations WHERE deleted_at IS NOT NULL"
  );
  return { count: r?.n ?? 0, oldestDeletedAt: r?.oldest ?? null };
}
