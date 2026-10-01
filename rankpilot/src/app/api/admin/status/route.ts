import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/get-session";
import { can } from "@/lib/auth/rbac";
import { err, ok } from "@/lib/http";
import { all, row } from "@/lib/db/db";
import { queueDepth } from "@/lib/jobs/queue";
import { productionConfigWarnings } from "@/lib/config";
import { isEmailConfigured } from "@/lib/email";
import { backupStatus } from "@/lib/backup-status";

/**
 * Owner-only operational view. This is the minimum needed to answer "is
 * anything broken?" without a log shipper: failed jobs and stuck crawl runs are
 * otherwise only visible by querying the database by hand.
 */
export async function GET(_req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role, "admin:read")) return err.forbidden();

  const failedJobs = all<{
    id: string;
    type: string;
    tenant_id: string | null;
    attempts: number;
    error: string | null;
    finished_at: string | null;
  }>(
    `SELECT id, type, tenant_id, attempts, error, finished_at
     FROM jobs WHERE status = 'failed' ORDER BY COALESCE(finished_at, created_at) DESC LIMIT 50`
  );

  const stuckCrawls = all<{
    id: string;
    website_id: string;
    tenant_id: string;
    status: string;
    started_at: string | null;
  }>(
    `SELECT id, website_id, tenant_id, status, started_at
     FROM crawl_runs WHERE status IN ('queued','running') ORDER BY created_at DESC LIMIT 50`
  );

  const failedCrawls = all<{ n: number }>(
    "SELECT COUNT(*) AS n FROM crawl_runs WHERE status = 'failed'"
  );

  return ok({
    queueDepth: queueDepth(),
    failedJobCount: row<{ n: number }>("SELECT COUNT(*) AS n FROM jobs WHERE status = 'failed'")?.n ?? 0,
    failedCrawlCount: failedCrawls[0]?.n ?? 0,
    failedJobs,
    stuckCrawls,
    // Surfaced here as well as at boot: a warning printed to a log on deploy day
    // is easy to miss, but this is the thing an operator actually looks at when
    // something is wrong. Empty in development.
    configWarnings: productionConfigWarnings(),
    emailConfigured: isEmailConfigured(),
    // Backups fail silently, so their absence has to be something you can read.
    backup: backupStatus(),
  });
}
