import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { can } from "@/lib/auth/rbac";
import { err, ok } from "@/lib/http";
import { all, newId, nowIso, row, run } from "@/lib/db/db";
import { getWebsite } from "@/lib/websites/repo";
import { audit } from "@/lib/audit";

/**
 * AI-search visibility checks. Without an AI-search integration connected we
 * record the query as observed-but-unmeasured (brand_mentioned = null), never
 * as a fabricated "not mentioned".
 */
const engines = ["general", "chatgpt", "perplexity", "gemini", "copilot"] as const;

const createSchema = z.object({
  websiteId: z.string().min(1),
  query: z.string().min(2).max(300),
  engine: z.enum(engines).default("general"),
});

export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  const websiteId = req.nextUrl.searchParams.get("websiteId");
  if (!websiteId) return err.validation("websiteId required");
  if (!getWebsite(s.org.id, websiteId)) return err.notFound();
  const items = all(
    `SELECT id, engine, query, brand_mentioned, competitor_mentions, source_urls, checked_at
     FROM ai_visibility WHERE website_id = ? AND tenant_id = ?
     ORDER BY created_at DESC LIMIT 100`,
    websiteId,
    s.org.id
  );
  return ok({ items });
}

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role, "website:write")) return err.forbidden();
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return err.validation(parsed.error.issues);
  const { websiteId, query, engine } = parsed.data;
  const website = getWebsite(s.org.id, websiteId);
  if (!website) return err.notFound();

  const integration = row<{ provider: string }>(
    "SELECT provider FROM integrations WHERE tenant_id = ? AND provider IN ('ai_search','serp','chatgpt') AND status = 'connected'",
    s.org.id
  );

  if (!integration) {
    const id = newId("vis");
    const now = nowIso();
    run(
      `INSERT INTO ai_visibility (id, tenant_id, website_id, engine, query, brand_mentioned, competitor_mentions, source_urls, checked_at, created_at)
       VALUES (?, ?, ?, ?, ?, NULL, '[]', '[]', ?, ?)`,
      id,
      s.org.id,
      websiteId,
      engine,
      query,
      now,
      now
    );
    audit({
      tenantId: s.org.id,
      userId: s.user.id,
      action: "visibility.track",
      entity: "ai_visibility",
      entityId: id,
      meta: { engine, websiteId },
    });
    return ok({
      id,
      engine,
      query,
      brandMentioned: null,
      status: "unmeasured",
      note: "No AI-search integration is connected, so this query is recorded as unmeasured — not as a miss.",
    });
  }

  // Integration present: a real provider call would go here. Until one is wired,
  // we still never guess — record unmeasured rather than fabricate a result.
  const id = newId("vis");
  const now = nowIso();
  run(
    `INSERT INTO ai_visibility (id, tenant_id, website_id, engine, query, brand_mentioned, competitor_mentions, source_urls, checked_at, created_at)
     VALUES (?, ?, ?, ?, ?, NULL, '[]', '[]', ?, ?)`,
    id,
    s.org.id,
    websiteId,
    engine,
    query,
    now,
    now
  );
  return ok({
    id,
    engine,
    query,
    brandMentioned: null,
    status: "unmeasured",
    note: "Integration connected but no provider response yet — recorded as unmeasured.",
  });
}
