import { NextRequest } from "next/server";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { can } from "@/lib/auth/rbac";
import { toCsv } from "@/lib/reports/csv";
import { toPdf } from "@/lib/reports/pdf";
import { err, ok } from "@/lib/http";
import { rateLimit } from "@/lib/security/rate-limit";
import { all, newId, nowIso, row, run, tx } from "@/lib/db/db";
import { bumpUsage } from "@/lib/usage";
import { getWebsite } from "@/lib/websites/repo";
import { assertReportQuota, QuotaExceededError } from "@/lib/ai/meter";
import { COMPONENT_LABELS } from "@/lib/scoring/score";
import { audit } from "@/lib/audit";

const createSchema = z.object({
  websiteId: z.string().min(1),
  type: z.enum(["growth", "issues", "content", "social", "usage"]).default("growth"),
  format: z.enum(["json", "csv", "pdf"]).default("json"),
});

export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  const websiteId = req.nextUrl.searchParams.get("websiteId");
  const where = websiteId ? "tenant_id = ? AND website_id = ?" : "tenant_id = ?";
  const params = websiteId ? [s.org.id, websiteId] : [s.org.id];
  const items = all(
    `SELECT id, website_id, type, format, status, file_path, created_at, completed_at
     FROM reports WHERE ${where} ORDER BY created_at DESC LIMIT 100`,
    ...params
  );
  return ok({ items: items.map((r) => ({ ...(r as Record<string, unknown>), file_path: undefined })) });
}

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role, "reports:run")) return err.forbidden();
  const rl = rateLimit(`report:${s.org.id}`, 10, 60_000);
  if (!rl.allowed) return err.rateLimited("Too many reports generated. Try again in a minute.");
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return err.validation(parsed.error.issues);
  const { websiteId, type, format } = parsed.data;
  const website = getWebsite(s.org.id, websiteId);
  if (!website) return err.notFound();

  try {
    assertReportQuota(s.org.id, s.org.plan);
  } catch (e) {
    if (e instanceof QuotaExceededError) return err.quota(e.message);
    throw e;
  }

  const id = newId("rep");
  const now = nowIso();
  const snapshot = buildSnapshot(s.org.id, websiteId, type, String((website as { name?: string }).name ?? ""));
  const rendered = render(snapshot, format);

  try {
    const dir = join(process.cwd(), "data", "reports", s.org.id);
    mkdirSync(dir, { recursive: true });
    const rel = join("data", "reports", s.org.id, `${id}.${format}`);
    writeFileSync(join(process.cwd(), rel), rendered, "utf8");
    tx(() => {
      run(
        `INSERT INTO reports (id, tenant_id, website_id, type, format, status, params, file_path, created_at, completed_at)
         VALUES (?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?)`,
        id,
        s.org.id,
        websiteId,
        type,
        format,
        JSON.stringify(snapshot.meta),
        rel,
        now,
        nowIso()
      );
      bumpUsage(s.org.id, "reports", 1);
    });
  } catch {
    run(
      "INSERT INTO reports (id, tenant_id, website_id, type, format, status, params, created_at) VALUES (?, ?, ?, ?, ?, 'failed', '{}', ?)",
      id,
      s.org.id,
      websiteId,
      type,
      format,
      now
    );
    return err.server();
  }

  audit({
    tenantId: s.org.id,
    userId: s.user.id,
    action: "report.generate",
    entity: "report",
    entityId: id,
    meta: { type, format, websiteId },
  });

  return ok({
    id,
    type,
    format,
    status: "completed",
    downloadUrl: `/api/reports/${id}`,
    summary: snapshot.summary,
    meta: snapshot.meta,
  });
}


interface Snapshot {
  meta: { period: string; generatedAt: string; disclaimer: string; website: string; type: string };
  summary: Array<{ label: string; value: string }>;
  score?: { overall: number; components: Record<string, number>; methodology: Record<string, unknown> };
  issues: Array<Record<string, unknown>>;
  keywords: Array<Record<string, unknown>>;
  pages: Array<Record<string, unknown>>;
  usage?: Array<Record<string, unknown>>;
}

function buildSnapshot(tenantId: string, websiteId: string, type: string, websiteName: string): Snapshot {
  const period = new Date().toISOString().slice(0, 7);
  const disclaimer =
    "Figures are observed crawl data only. No ranking, traffic or revenue outcomes are predicted or guaranteed.";
  const scoreRow = row<{ overall: number; components: string; methodology: string }>(
    "SELECT overall, components, methodology FROM scores WHERE website_id = ? ORDER BY created_at DESC LIMIT 1",
    websiteId
  );
  const issues = all(
    `SELECT code, category, severity, title, status, why_it_matters, recommendation
     FROM seo_issues WHERE website_id = ? AND tenant_id = ? ORDER BY
     CASE severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END LIMIT 200`,
    websiteId,
    tenantId
  ) as Array<Record<string, unknown>>;
  const keywords = all(
    "SELECT term, intent, volume, difficulty, current_rank, occurrences FROM keywords WHERE website_id = ? AND tenant_id = ? LIMIT 200",
    websiteId,
    tenantId
  ) as Array<Record<string, unknown>>;
  const pages = all(
    "SELECT url, title, word_count, status_code, is_indexable, images_missing_alt FROM pages WHERE website_id = ? AND tenant_id = ? LIMIT 200",
    websiteId,
    tenantId
  ) as Array<Record<string, unknown>>;
  const usage = type === "usage"
    ? (all(
        "SELECT task, model, tokens_in, tokens_out, cost_usd, status, created_at FROM ai_usage WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 200",
        tenantId
      ) as Array<Record<string, unknown>>)
    : undefined;

  return {
    meta: { period, generatedAt: nowIso(), disclaimer, website: websiteName, type },
    summary: [
      { label: "Score", value: scoreRow ? String(scoreRow.overall) : "Data unavailable" },
      { label: "Open issues", value: String(issues.filter((i) => i.status === "new").length) },
      { label: "Keywords", value: String(keywords.length) },
      { label: "Pages crawled", value: String(pages.length) },
    ],
    score: scoreRow
      ? {
          overall: scoreRow.overall,
          components: JSON.parse(scoreRow.components || "{}") as Record<string, number>,
          methodology: JSON.parse(scoreRow.methodology || "{}") as Record<string, unknown>,
        }
      : undefined,
    issues,
    keywords,
    pages,
    usage,
  };
}

function render(s: Snapshot, format: string): string {
  if (format === "json") return JSON.stringify(s, null, 2);
  if (format === "csv") return toCsv({ ...s, componentLabels: COMPONENT_LABELS });
  return toPdf({
    website: s.meta.website,
    generatedAt: s.meta.generatedAt,
    disclaimer: s.meta.disclaimer,
    summary: s.summary,
    issues: s.issues,
    keywords: s.keywords,
  });
}
