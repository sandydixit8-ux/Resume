import { all, row } from "@/lib/db/db";

export interface WebsiteRow {
  id: string;
  tenant_id: string;
  name: string;
  url: string;
  normalized_url: string;
  verification_token: string | null;
  verified_at: string | null;
  industry: string | null;
  country: string | null;
  audience: string | null;
  products: string | null;
  primary_keywords: string | null;
  target_market: string | null;
  competitor_urls: string;
  last_crawled_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/** Tenant-scoped read: a website from another tenant simply does not exist. */
export function getWebsite(tenantId: string, id: string): WebsiteRow | undefined {
  return row<WebsiteRow>(
    "SELECT * FROM websites WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL",
    id,
    tenantId
  );
}

export function listWebsites(tenantId: string): Array<
  WebsiteRow & {
    score: number | null;
    last_run_status: string | null;
    issues_open: number;
  }
> {
  return all<
    WebsiteRow & { score: number | null; last_run_status: string | null; issues_open: number }
  >(
    `SELECT w.*,
            (SELECT overall FROM scores s WHERE s.website_id = w.id ORDER BY s.created_at DESC LIMIT 1) AS score,
            (SELECT status FROM crawl_runs r WHERE r.website_id = w.id ORDER BY r.created_at DESC LIMIT 1) AS last_run_status,
            (SELECT COUNT(*) FROM seo_issues i WHERE i.website_id = w.id AND i.status = 'new') AS issues_open
     FROM websites w
     WHERE w.tenant_id = ? AND w.deleted_at IS NULL
     ORDER BY w.created_at DESC`,
    tenantId
  );
}

export function countWebsites(tenantId: string): number {
  const r = row<{ n: number }>(
    "SELECT COUNT(*) AS n FROM websites WHERE tenant_id = ? AND deleted_at IS NULL",
    tenantId
  );
  return r?.n ?? 0;
}
