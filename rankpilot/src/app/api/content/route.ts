import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { can } from "@/lib/auth/rbac";
import { err, ok } from "@/lib/http";
import { all, newId, nowIso, row, run, tx } from "@/lib/db/db";
import { getWebsite } from "@/lib/websites/repo";
import { aiCall, isNextResponse } from "@/lib/ai/server";
import { audit } from "@/lib/audit";

const generateSchema = z.object({
  websiteId: z.string().min(1),
  brief: z.object({
    title: z.string().max(300).default(""),
    goal: z.string().max(500).default(""),
    keyword: z.string().max(200).default(""),
    intent: z.string().max(60).default("informational"),
    audience: z.string().max(200).default(""),
    tone: z.string().max(60).default("professional"),
    type: z.enum(["article", "landing", "faq", "comparison", "howto"]).default("article"),
    cta: z.string().max(300).default(""),
  }),
});

export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  const websiteId = req.nextUrl.searchParams.get("websiteId");
  if (!websiteId) return err.validation("websiteId required");
  if (!getWebsite(s.org.id, websiteId)) return err.notFound();

  const items = all(
    `SELECT id, website_id, title, type, status, channel, created_at, updated_at
     FROM content WHERE website_id = ? AND tenant_id = ? AND deleted_at IS NULL
     ORDER BY updated_at DESC LIMIT 100`,
    websiteId,
    s.org.id
  );
  return ok({ items });
}

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role, "content:write")) return err.forbidden();
  const body = await req.json().catch(() => null);
  const parsed = generateSchema.safeParse(body);
  if (!parsed.success) return err.validation(parsed.error.issues);
  const { websiteId, brief } = parsed.data;
  if (!getWebsite(s.org.id, websiteId)) return err.notFound();

  const outcome = await aiCall<{
    title: string;
    metaDescription: string;
    h1: string;
    outline: string[];
    article: string;
    faqs: Array<{ question: string; answer: string }>;
    cta: string;
    internalLinkIdeas: string[];
  }>(
    "content.generate",
    { websiteId, brief },
    "content:write"
  );
  if (isNextResponse(outcome)) return outcome;
  const { result } = outcome;

  const contentId = newId("cnt");
  const versionId = newId("cv");
  const now = nowIso();
  const changes = [
    {
      field: "title",
      before: "",
      after: result.data.title,
      why: "Generated from your brief.",
    },
    {
      field: "metaDescription",
      before: "",
      after: result.data.metaDescription,
      why: "Meta description drafted for search snippets.",
    },
  ];

  tx(() => {
    run(
      `INSERT INTO content (id, tenant_id, website_id, type, title, slug, body, meta, status, channel, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', 'web', ?, ?)`,
      contentId,
      s.org.id,
      websiteId,
      brief.type,
      result.data.title || brief.title || "Untitled draft",
      null,
      result.data.article,
      JSON.stringify({
        metaDescription: result.data.metaDescription,
        h1: result.data.h1,
        outline: result.data.outline,
        faqs: result.data.faqs,
        cta: result.data.cta,
        internalLinkIdeas: result.data.internalLinkIdeas,
        brief,
        source: result.source,
        promptVersion: result.promptVersion,
        degraded: result.degraded ?? null,
      }),
      now,
      now
    );
    run(
      `INSERT INTO content_versions (id, tenant_id, content_id, version, title, body, meta, changes, source, status, created_at)
       VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, 'draft', ?)`,
      versionId,
      s.org.id,
      contentId,
      result.data.title || brief.title || "Untitled draft",
      result.data.article,
      JSON.stringify({ metaDescription: result.data.metaDescription, h1: result.data.h1 }),
      JSON.stringify(changes),
      result.source,
      now
    );
  });

  audit({
    tenantId: s.org.id,
    userId: s.user.id,
    action: "content.generate",
    entity: "content",
    entityId: contentId,
    meta: { websiteId, source: result.source, degraded: result.degraded ?? null },
  });

  return ok({
    contentId,
    versionId,
    source: result.source,
    degraded: result.degraded ?? null,
    promptVersion: result.promptVersion,
    model: result.model,
    preview: {
      title: result.data.title,
      metaDescription: result.data.metaDescription,
      outline: result.data.outline,
      faqs: result.data.faqs,
    },
  });
}

export function rowContent(id: string, tenantId: string) {
  return row("SELECT * FROM content WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL", id, tenantId);
}
