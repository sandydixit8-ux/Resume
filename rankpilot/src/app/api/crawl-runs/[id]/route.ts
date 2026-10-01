import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/get-session";
import { err, ok } from "@/lib/http";
import { row } from "@/lib/db/db";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return err.auth();
  const { id } = await ctx.params;

  const runRow = row<{
    id: string;
    tenant_id: string;
    website_id: string;
    status: string;
    trigger: string;
    pages_discovered: number;
    pages_analyzed: number;
    issues_found: number;
    keywords_found: number;
    questions_found: number;
    opportunities_found: number;
    bytes_downloaded: number;
    avg_response_ms: number;
    started_at: string | null;
    finished_at: string | null;
    error: string | null;
    stats: string;
  }>("SELECT * FROM crawl_runs WHERE id = ? AND tenant_id = ?", id, s.org.id);

  if (!runRow) return err.notFound();

  const stats = JSON.parse(runRow.stats || "{}") as Record<string, unknown>;
  return ok({
    run: {
      id: runRow.id,
      websiteId: runRow.website_id,
      status: runRow.status,
      trigger: runRow.trigger,
      progress: {
        pagesDiscovered: runRow.pages_discovered,
        pagesAnalyzed: runRow.pages_analyzed,
        issuesFound: runRow.issues_found,
        keywordsFound: runRow.keywords_found,
        questionsFound: runRow.questions_found,
        opportunitiesFound: runRow.opportunities_found,
        bytesDownloaded: runRow.bytes_downloaded,
        avgResponseMs: runRow.avg_response_ms,
      },
      robotsPresent: stats.robotsPresent ?? false,
      sitemapPresent: stats.sitemapPresent ?? false,
      robotsSkipped: stats.robotsSkipped ?? 0,
      errors: stats.errors ?? 0,
      startedAt: runRow.started_at,
      finishedAt: runRow.finished_at,
      error: runRow.error,
    },
  });
}
