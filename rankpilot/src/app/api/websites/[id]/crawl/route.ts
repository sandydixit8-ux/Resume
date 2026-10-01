import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { err, getClientIp, ok } from "@/lib/http";
import { rateLimit } from "@/lib/security/rate-limit";
import { getWebsite } from "@/lib/websites/repo";
import { enqueue } from "@/lib/jobs/queue";
import { startWorker } from "@/lib/jobs/worker";
import { registerCrawlerJobs } from "@/lib/crawler/register";
import { effectivePageCap } from "@/lib/crawler/run";
import { newId, nowIso, row, run } from "@/lib/db/db";
import { audit } from "@/lib/audit";
import { can } from "@/lib/auth/rbac";

const schema = z.object({ maxPages: z.number().int().min(1).max(5000).optional() });

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role, "crawl:run")) return err.forbidden();

  const ip = getClientIp(req);
  const rl = rateLimit(`crawl:${s.org.id}`, 10, 60 * 60_000);
  if (!rl.allowed) return err.rateLimited("Crawl limit reached. Try again later.");

  const { id } = await ctx.params;
  const website = getWebsite(s.org.id, id);
  if (!website) return err.notFound();

  const active = row<{ id: string }>(
    "SELECT id FROM crawl_runs WHERE website_id = ? AND status IN ('queued','running') LIMIT 1",
    id
  );
  if (active) return err.conflict("A crawl is already in progress for this website.");

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return err.validation(parsed.error.issues);

  // The plan and the operator cap both apply; say so instead of quietly crawling less.
  const requested = parsed.data.maxPages ?? null;
  const maxPages = effectivePageCap(s.org.plan, requested);
  const capped = requested !== null && requested > maxPages;

  const runId = newId("run");
  run(
    `INSERT INTO crawl_runs (id, tenant_id, website_id, status, trigger, created_at)
     VALUES (?, ?, ?, 'queued', 'manual', ?)`,
    runId,
    s.org.id,
    id,
    nowIso()
  );
  enqueue({
    tenantId: s.org.id,
    type: "crawl.run",
    payload: { runId, websiteId: id, maxPages },
  });

  registerCrawlerJobs();
  startWorker();
  audit({ tenantId: s.org.id, userId: s.user.id, action: "crawl.start", entity: "crawl_run", entityId: runId, ip });

  return ok({
    runId,
    maxPages,
    ...(capped
      ? { notice: `Page budget reduced to ${maxPages} by your plan or the server crawl limit.` }
      : {}),
  });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const s = await getSession();
  if (!s) return err.auth();
  const { id } = await ctx.params;
  const website = getWebsite(s.org.id, id);
  if (!website) return err.notFound();
  const active = row<{ id: string }>(
    "SELECT id FROM crawl_runs WHERE website_id = ? AND status IN ('queued','running') LIMIT 1",
    id
  );
  if (!active) return err.notFound();
  run("UPDATE crawl_runs SET status = 'cancelled', finished_at = ? WHERE id = ?", nowIso(), active.id);
  audit({
    tenantId: s.org.id,
    userId: s.user.id,
    action: "crawl.cancel",
    entity: "crawl_run",
    entityId: active.id,
    meta: { websiteId: id },
  });
  return ok({ cancelled: true, runId: active.id });
}
