import { createHash } from "node:crypto";
import { all, row } from "@/lib/db/db";

/** Everything AI sees comes from here. Empty sections are marked "unavailable" — never guessed. */

export interface ContextPack {
  website: Record<string, unknown> | "unavailable";
  score: Record<string, unknown> | "unavailable";
  topIssues: Array<Record<string, unknown>>;
  pagesSummary: Record<string, unknown> | "unavailable";
  keywords: Array<Record<string, unknown>>;
  questions: Array<Record<string, unknown>>;
  page?: Record<string, unknown> | "unavailable";
  content?: Record<string, unknown> | "unavailable";
  brief?: Record<string, unknown> | "unavailable";
  integrations: Array<Record<string, unknown>>;
}

const UNAVAILABLE = "unavailable" as const;

export function buildContextPack(input: {
  tenantId: string;
  websiteId?: string;
  pageId?: string;
  contentId?: string;
  brief?: Record<string, unknown> | "unavailable";
}): ContextPack {
  const { tenantId, websiteId } = input;

  const website = websiteId
    ? row(
        "SELECT id, name, normalized_url, industry, country, audience, products, primary_keywords FROM websites WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL",
        websiteId,
        tenantId
      )
    : null;

  const scoreRow = websiteId
    ? row<{ overall: number; components: string }>(
        "SELECT overall, components FROM scores WHERE website_id = ? ORDER BY created_at DESC LIMIT 1",
        websiteId
      )
    : undefined;

  const topIssues = websiteId
    ? all(
        `SELECT code, severity, category, title, why_it_matters, recommendation, evidence
         FROM seo_issues WHERE website_id = ? AND status = 'new'
         ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END
         LIMIT 15`,
        websiteId
      )
    : [];

  const pagesSummary = websiteId
    ? (row(
        `SELECT COUNT(*) AS pages, AVG(word_count) AS avg_words,
                SUM(CASE WHEN is_indexable = 1 THEN 1 ELSE 0 END) AS indexable,
                SUM(images_missing_alt) AS images_missing_alt
         FROM pages WHERE website_id = ?`,
        websiteId
      ) ?? UNAVAILABLE)
    : UNAVAILABLE;

  const keywords = websiteId
    ? all("SELECT term, intent, occurrences, recommended_url FROM keywords WHERE website_id = ? LIMIT 40", websiteId)
    : [];

  const questions = websiteId
    ? all(
        "SELECT text, intent, priority, recommended_answer FROM questions WHERE website_id = ? LIMIT 30",
        websiteId
      )
    : [];

  const page = input.pageId
    ? row(
        "SELECT url, title, meta_description, h1, headings, word_count, text_sample FROM pages WHERE id = ? AND tenant_id = ?",
        input.pageId,
        tenantId
      )
    : undefined;

  const content = input.contentId
    ? row("SELECT id, type, title, body, meta, status FROM content WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL", input.contentId, tenantId)
    : undefined;

  const integrations = all(
    "SELECT provider, status FROM integrations WHERE tenant_id = ?",
    tenantId
  );

  return {
    website: website ?? UNAVAILABLE,
    score: scoreRow
      ? { overall: scoreRow.overall, components: JSON.parse(scoreRow.components || "{}") }
      : UNAVAILABLE,
    topIssues,
    pagesSummary,
    keywords,
    questions,
    page: page ?? UNAVAILABLE,
    content: content ?? UNAVAILABLE,
    brief: input.brief ?? UNAVAILABLE,
    integrations,
  };
}

export function contextHash(pack: ContextPack): string {
  return createHash("sha256").update(JSON.stringify(pack)).digest("hex").slice(0, 32);
}
