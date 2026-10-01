/**
 * Search Console sync.
 *
 * Pulls observed Search Analytics rows for a tenant's website into `keywords`
 * with `source = 'gsc'`, so CTR and ranking fields are governed by data Google
 * actually reported — never estimated. Two safety rails:
 *
 *  - Deadline: GSC metrics finalize ~2-3 days late. A configurable deadline
 *    (GSC_DEADLINE_DAYS, default 3) excludes trailing days so we never import a
 *    window Google itself still considers provisional. The window is always
 *    [today - 27, today - deadline].
 *  - Revoke: disconnecting Search Console removes the imported rows, so "Data
 *    unavailable" is honest again instead of stale clicks persisting.
 *
 * Upserts respect the (website_id, term, source) uniqueness key: an existing
 * 'gsc' row for the same term is refreshed, a crawl-generated row for the same
 * term is left alone (different source, both are real observations).
 */

import { all, row, run, newId, nowIso } from "@/lib/db/db";
import { getWebsite } from "@/lib/websites/repo";
import {
  exchangeToken,
  querySearchAnalytics,
  verifiedSiteFor,
  type GscConfig,
  type SearchAnalyticsRow,
} from "./gsc";

export interface SyncContext {
  tenantId: string;
  websiteId: string;
  config: GscConfig;
  fetchFn?: typeof fetch;
  now?: Date;
}

export interface SyncResult {
  ok: boolean;
  imported: number;
  window: { startDate: string; endDate: string };
  siteUrl: string | null;
  deadlineDays: number;
  problem?: string;
}

export function deadlineDays(env: Record<string, string | undefined> = process.env): number {
  const n = Number(env.GSC_DEADLINE_DAYS);
  return Number.isFinite(n) && n >= 0 && n <= 7 ? Math.floor(n) : 3;
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Import one tenant website's Search Analytics snapshot. */
export async function syncSearchConsole(ctx: SyncContext): Promise<SyncResult> {
  const deadline = deadlineDays();
  const windowEnd = new Date(ctx.now ?? new Date());
  windowEnd.setDate(windowEnd.getDate() - deadline);
  windowEnd.setUTCHours(0, 0, 0, 0);
  const windowStart = new Date(windowEnd);
  windowStart.setUTCDate(windowStart.getUTCDate() - 27);

  const website = getWebsite(ctx.tenantId, ctx.websiteId);
  if (!website) {
    return {
      ok: false,
      imported: 0,
      window: { startDate: iso(windowStart), endDate: iso(windowEnd) },
      siteUrl: null,
      deadlineDays: deadline,
      problem: "missing website",
    };
  }

  const fetchFn = ctx.fetchFn ?? fetch;
  const token = await exchangeToken(ctx.config, fetchFn, ctx.now ?? new Date());
  const verified = await verifiedSiteFor(token, website.normalized_url, fetchFn);
  if (!verified) {
    return {
      ok: false,
      imported: 0,
      window: { startDate: iso(windowStart), endDate: iso(windowEnd) },
      siteUrl: null,
      deadlineDays: deadline,
      problem: "no_access",
    };
  }

  const rows: SearchAnalyticsRow[] = await querySearchAnalytics(
    token,
    {
      siteUrl: verified.siteUrl,
      startDate: iso(windowStart),
      endDate: iso(windowEnd),
      rowLimit: 200,
    },
    fetchFn
  );

  let imported = 0;
  const now = nowIso();
  for (const r of rows) {
    const term = (r.keys[0] ?? "").trim().toLowerCase();
    if (!term) continue;
    const existing = row<{ id: string }>(
      "SELECT id FROM keywords WHERE website_id = ? AND term = ? AND source = 'gsc'",
      ctx.websiteId,
      term
    );
    if (existing) {
      run(
        "UPDATE keywords SET current_rank = ?, ctr = ?, updated_at = ? WHERE id = ?",
        r.position,
        r.ctr,
        now,
        existing.id
      );
    } else {
      run(
        `INSERT INTO keywords (id, tenant_id, website_id, term, source, intent, volume, difficulty,
           current_rank, ctr, recommended_url, page_id, occurrences, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'gsc', 'informational', NULL, NULL, ?, ?, NULL, NULL, 1, ?, ?)`,
        newId("kw"),
        ctx.tenantId,
        ctx.websiteId,
        term,
        r.position,
        r.ctr,
        now,
        now
      );
    }
    imported++;
  }

  return {
    ok: true,
    imported,
    window: { startDate: iso(windowStart), endDate: iso(windowEnd) },
    siteUrl: verified.siteUrl,
    deadlineDays: deadline,
  };
}

/** Drop every GSC-imported row for the tenant's websites (called on revoke). */
export function revokeSearchConsole(tenantId: string): number {
  const ids = all<{ id: string }>(
    `SELECT k.id FROM keywords k
     JOIN websites w ON w.id = k.website_id AND w.tenant_id = ?
     WHERE k.source = 'gsc'`,
    tenantId
  );
  for (const { id } of ids) run("DELETE FROM keywords WHERE id = ?", id);
  return ids.length;
}