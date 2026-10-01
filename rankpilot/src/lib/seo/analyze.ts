import { all, newId, nowIso, row, run, tx } from "@/lib/db/db";
import { ALL_CHECKS } from "./checks";
import { classifyIntent, countPhraseOccurrences, deriveTerms } from "./intent";
import type { CheckContext, CheckOutcome, PageLite, WebsiteLite } from "./types";
import { computeScore } from "@/lib/scoring/score";
import { getLimits } from "@/lib/plans";

/** Hard per-run ceiling, independent of plan, so no single crawl writes an unbounded list. */
const MAX_KEYWORDS_PER_RUN = 100;

export interface AnalyzeInput {
  tenantId: string;
  websiteId: string;
  runId: string;
  /** Owning org's plan; caps how many new keywords this run may persist. */
  plan?: string;
}

export interface AnalyzeResult {
  issues: number;
  newIssues: number;
  score: number;
  keywords: number;
  questions: number;
  actions: number;
  /** True when the plan's keyword allowance stopped us mid-list, so reports must say so. */
  keywordCapHit?: boolean;
}

export function analyzeRun(input: AnalyzeInput): AnalyzeResult {
  const website = row<WebsiteLite>(
    "SELECT id, url, normalized_url, primary_keywords FROM websites WHERE id = ? AND tenant_id = ?",
    input.websiteId,
    input.tenantId
  );
  if (!website) throw new Error("website_not_found");

  const pages = all<PageLite>(
    "SELECT * FROM pages WHERE website_id = ? AND run_id = ?",
    input.websiteId,
    input.runId
  );
  const stats = JSON.parse(
    row<{ stats: string }>("SELECT stats FROM crawl_runs WHERE id = ?", input.runId)?.stats ?? "{}"
  ) as { robotsPresent?: boolean; sitemapPresent?: boolean; broken?: Array<{ url: string; status: number; from: string }> };

  const inboundLinks = new Map<string, number>();
  for (const p of pages) inboundLinks.set(p.id, p.inbound_link_count ?? 0);

  const ctx: CheckContext = {
    website,
    pages,
    robotsPresent: stats.robotsPresent ?? false,
    sitemapPresent: stats.sitemapPresent ?? false,
    inboundLinks,
    sameSiteUrlKeys: new Set(pages.map((p) => p.url_key)),
    brokenInternalUrls: stats.broken ?? [],
  };

  const outcomes = ALL_CHECKS.map((check) => check(ctx));
  const startedAt = row<{ started_at: string }>(
    "SELECT started_at FROM crawl_runs WHERE id = ?",
    input.runId
  )?.started_at ?? nowIso();

  const { newIssues, totalIssues } = persistIssues(input, outcomes, startedAt);
  const keywords = discoverKeywords(input, website, pages);
  const questions = discoverQuestions(input, pages);
  const score = computeScore(outcomes, {
    linked: pages.filter((p) => p.is_indexable === 1 && (p.inbound_link_count ?? 0) > 0).length,
    total: pages.filter((p) => p.is_indexable === 1).length,
  });
  const actions = createActionsForTopIssues(input);

  run(
    `INSERT INTO scores (id, tenant_id, website_id, run_id, overall, components, methodology, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    newId("scr"),
    input.tenantId,
    input.websiteId,
    input.runId,
    score.overall,
    JSON.stringify(score.components),
    JSON.stringify(score.methodology),
    nowIso()
  );

  run(
    `UPDATE crawl_runs SET issues_found = ?, keywords_found = ?, questions_found = ?,
       opportunities_found = ? WHERE id = ?`,
    totalIssues,
    keywords.inserted,
    questions,
    questions + keywords.inserted,
    input.runId
  );

  return {
    issues: totalIssues,
    newIssues,
    score: score.overall,
    keywords: keywords.inserted,
    questions,
    actions,
    ...(keywords.capHit ? { keywordCapHit: true } : {}),
  };
}

function persistIssues(
  input: AnalyzeInput,
  outcomes: CheckOutcome[],
  runStartedAt: string
): { newIssues: number; totalIssues: number } {
  const existing = all<{ id: string; code: string; page_id: string | null; status: string }>(
    "SELECT id, code, page_id, status FROM seo_issues WHERE website_id = ?",
    input.websiteId
  );
  const existingMap = new Map(existing.map((e) => [`${e.code}|${e.page_id ?? ""}`, e]));
  const touched: string[] = [];
  let newIssues = 0;
  let totalIssues = 0;
  const now = nowIso();

  tx(() => {
    for (const outcome of outcomes) {
      for (const failure of outcome.failures) {
        totalIssues++;
        const pageId = failure.pageId ?? null;
        const key = `${outcome.code}|${pageId ?? ""}`;
        const prior = existingMap.get(key);
        if (prior) {
          const status =
            prior.status === "resolved"
              ? "new"
              : prior.status === "ignored"
                ? "ignored"
                : prior.status;
          run(
            `UPDATE seo_issues SET last_seen_at = ?, run_id = ?, status = ?, evidence = ?, updated_at = ?
             WHERE id = ?`,
            now,
            input.runId,
            status,
            JSON.stringify({ detail: failure.detail, ...failure.evidence }),
            now,
            prior.id
          );
          touched.push(prior.id);
        } else {
          const id = newId("iss");
          run(
            `INSERT INTO seo_issues (id, tenant_id, website_id, run_id, page_id, code, category, severity,
               title, description, why_it_matters, recommendation, evidence, status,
               first_seen_at, last_seen_at, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?, ?)`,
            id,
            input.tenantId,
            input.websiteId,
            input.runId,
            pageId,
            outcome.code,
            outcome.category,
            outcome.severity,
            outcome.title,
            failure.detail,
            outcome.whyItMatters,
            outcome.recommendation,
            JSON.stringify({ detail: failure.detail, ...failure.evidence }),
            now,
            now,
            now,
            now
          );
          touched.push(id);
          newIssues++;
        }
      }
    }

    const idList = touched.length ? touched.map(() => "?").join(",") : "''";
    run(
      `UPDATE seo_issues SET status = 'resolved', resolved_at = ?, updated_at = ?
       WHERE website_id = ? AND status IN ('new','in_progress') AND last_seen_at < ?
         AND id NOT IN (${idList})`,
      now,
      now,
      input.websiteId,
      runStartedAt,
      ...(touched as string[])
    );
  });

  return { newIssues, totalIssues };
}

function discoverKeywords(
  input: AnalyzeInput,
  website: WebsiteLite,
  pages: PageLite[]
): { inserted: number; capHit: boolean } {
  const now = nowIso();
  let count = 0;

  const primary = (website.primary_keywords ?? "")
    .split(/[,;\n]/)
    .map((k) => k.trim())
    .filter((k) => k.length >= 2);

  const candidates: Array<{ term: string; derived: boolean }> = [
    ...primary.map((term) => ({ term, derived: false })),
    ...deriveTerms(pages.flatMap((p) => [p.title ?? "", h1Of(p), ...headingsOf(p)]), 25).map(
      (d) => ({ term: d.term, derived: true })
    ),
  ];

  // Plan allowance, minus what this tenant already tracks. Untracked plans (-1)
  // still get a per-run ceiling so one crawl cannot write an unbounded list.
  const planCap = getLimits(input.plan ?? "free").keywords;
  const tracked = row<{ n: number }>(
    "SELECT COUNT(*) AS n FROM keywords WHERE tenant_id = ?",
    input.tenantId
  );
  const already = tracked?.n ?? 0;
  const allowance = planCap === -1 ? Number.POSITIVE_INFINITY : Math.max(0, planCap - already);
  let budget = Math.min(allowance, MAX_KEYWORDS_PER_RUN);
  let capHit = false;

  for (const candidate of candidates) {
    const term = candidate.term.toLowerCase();
    let best: { url: string; id: string; occurrences: number } | null = null;
    let total = 0;
    for (const p of pages) {
      const occurrences =
        countPhraseOccurrences(`${p.title ?? ""} ${p.h1 ?? ""} ${p.text_sample}`, term) +
        countPhraseOccurrences(headingsOf(p).join(" "), term);
      if (occurrences > 0) {
        total += occurrences;
        if (!best || occurrences > best.occurrences) {
          best = { url: p.url, id: p.id, occurrences };
        }
      }
    }
    if (!best) continue;

    const existing = row<{ id: string }>(
      "SELECT id FROM keywords WHERE website_id = ? AND term = ? AND source = 'crawl'",
      input.websiteId,
      term
    );
    if (existing) {
      run(
        "UPDATE keywords SET occurrences = ?, recommended_url = ?, page_id = ?, updated_at = ? WHERE id = ?",
        total,
        best.url,
        best.id,
        now,
        existing.id
      );
    } else {
      if (budget <= 0) {
        // Allowance spent. Keep scanning so already-tracked terms still refresh,
        // but never grow the list past what the plan paid for.
        capHit = true;
        continue;
      }
      run(
        `INSERT INTO keywords (id, tenant_id, website_id, term, source, intent, volume, difficulty,
           current_rank, ctr, recommended_url, page_id, occurrences, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'crawl', ?, NULL, NULL, NULL, NULL, ?, ?, ?, ?, ?)`,
        newId("kw"),
        input.tenantId,
        input.websiteId,
        term,
        classifyIntent(term),
        best.url,
        best.id,
        total,
        now,
        now
      );
      count++;
      budget--;
    }
    if (count >= MAX_KEYWORDS_PER_RUN) break;
  }
  return { inserted: count, capHit };
}

function h1Of(p: PageLite): string {
  return p.h1 ?? "";
}

function headingsOf(p: PageLite): string[] {
  try {
    const hs = JSON.parse(p.headings) as Array<{ text: string }>;
    return hs.map((h) => h.text);
  } catch {
    return [];
  }
}

const QUESTION_MAX_PER_PAGE = 5;

function discoverQuestions(input: AnalyzeInput, pages: PageLite[]): number {
  const now = nowIso();
  const seen = new Set(
    all<{ text: string }>("SELECT text FROM questions WHERE website_id = ?", input.websiteId).map(
      (q) => q.text.toLowerCase()
    )
  );
  let inserted = 0;
  const primary = (row<{ primary_keywords: string | null }>(
    "SELECT primary_keywords FROM websites WHERE id = ?",
    input.websiteId
  )?.primary_keywords ?? ""
  )
    .split(/[,;\n]/)
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean);

  for (const p of pages) {
    if (p.is_indexable !== 1) continue;
    const candidates = new Set<string>();
    for (const h of headingsOf(p)) {
      if (h.trim().endsWith("?") && h.length <= 140) candidates.add(h.trim());
    }
    for (const sentence of splitSentences(p.text_sample)) {
      if (!sentence.includes("?")) continue;
      if (!/^(how|what|why|when|where|which|who|can|does|do|is|are|should|what's|why is|how do|how can|how does)\b/i.test(sentence)) {
        continue;
      }
      if (sentence.length < 15 || sentence.length > 140) continue;
      candidates.add(sentence);
    }

    let onPage = 0;
    for (const text of candidates) {
      if (onPage >= QUESTION_MAX_PER_PAGE) break;
      const key = text.toLowerCase().replace(/\s+/g, " ");
      if (seen.has(key)) continue;
      seen.add(key);
      onPage++;
      inserted++;
      const hasKeyword = primary.some((k) => k && key.includes(k));
      const priority = hasKeyword
        ? "high"
        : /\b(best|vs|versus|compare|which|should i)\b/i.test(text)
          ? "high"
          : /^(how|what|why)/i.test(text)
            ? "medium"
            : "low";
      run(
        `INSERT INTO questions (id, tenant_id, website_id, page_id, text, intent, source, priority,
           recommended_url, schema_type, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'aeo', ?, ?, 'FAQPage', ?)`,
        newId("q"),
        input.tenantId,
        input.websiteId,
        p.id,
        text,
        classifyIntent(text),
        priority,
        p.url,
        now
      );
    }
  }
  return inserted;
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function createActionsForTopIssues(input: AnalyzeInput): number {
  const candidates = all<{ id: string; title: string; severity: string; recommendation: string; page_id: string | null }>(
    `SELECT id, title, severity, recommendation, page_id FROM seo_issues
     WHERE website_id = ? AND status = 'new' AND severity IN ('critical','high')
     ORDER BY CASE severity WHEN 'critical' THEN 0 ELSE 1 END, created_at
     LIMIT 25`,
    input.websiteId
  );
  const already = new Set(
    all<{ issue_id: string }>(
      "SELECT issue_id FROM actions WHERE website_id = ? AND issue_id IS NOT NULL",
      input.websiteId
    ).map((a) => a.issue_id)
  );
  const now = nowIso();
  let created = 0;
  for (const c of candidates) {
    if (already.has(c.id)) continue;
    run(
      `INSERT INTO actions (id, tenant_id, website_id, issue_id, title, description, priority, impact,
         effort, status, source, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'high', 'high', 'medium', 'new', 'issue', ?, ?)`,
      newId("act"),
      input.tenantId,
      input.websiteId,
      c.id,
      c.title,
      c.recommendation,
      now,
      now
    );
    created++;
  }
  return created;
}
