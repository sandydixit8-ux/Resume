import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const worker = process.env.VITEST_WORKER_ID ?? process.env.VITEST_POOL_ID ?? "1";
process.env.RANKPILOT_DB_PATH = join(
  process.env.RANKPILOT_TEST_DIR ?? mkdtempSync(join(tmpdir(), "rankpilot-test-")),
  `analyze-${worker}.db`
);

import { describe, expect, it } from "vitest";
import { all, newId, nowIso, run } from "@/lib/db/db";
import { analyzeRun } from "./analyze";
import { getLimits } from "@/lib/plans";

function makeOrg(plan: string): string {
  const id = newId("org");
  const now = nowIso();
  run(
    "INSERT INTO organizations (id, name, slug, plan, created_at, updated_at) VALUES (?, 'T', ?, ?, ?, ?)",
    id,
    `t-${id.slice(-6)}`,
    plan,
    now,
    now
  );
  return id;
}

interface Fixture {
  tenantId: string;
  websiteId: string;
  runId: string;
}

const HEADINGS = Array.from({ length: 40 }, (_, i) => ({
  text: `alpha keyword topic number ${i} section`,
}));

/**
 * 60 explicit primary keywords plus whatever `deriveTerms` finds in the headings:
 * comfortably more candidates than the free plan (50) is allowed to keep.
 */
const PRIMARY = Array.from({ length: 60 }, (_, i) => `primary target phrase ${i}`);

function makeCrawl(plan: string, primaryKeywords: string[] = PRIMARY): Fixture {
  const tenantId = makeOrg(plan);
  const websiteId = newId("ws");
  const runId = newId("run");
  const now = nowIso();

  run(
    `INSERT INTO websites (id, tenant_id, name, url, normalized_url, primary_keywords, competitor_urls, created_at, updated_at)
     VALUES (?, ?, 'Site', 'https://example.com/', 'https://example.com', ?, '[]', ?, ?)`,
    websiteId,
    tenantId,
    primaryKeywords.join(", "),
    now,
    now
  );
  run(
    `INSERT INTO crawl_runs (id, tenant_id, website_id, status, trigger, stats, created_at, started_at)
     VALUES (?, ?, ?, 'done', 'manual', '{}', ?, ?)`,
    runId,
    tenantId,
    websiteId,
    now,
    now
  );
  run(
    `INSERT INTO pages (id, tenant_id, website_id, run_id, url, url_key, title, h1, headings,
       text_sample, word_count, status_code, is_indexable, fetched_at)
     VALUES (?, ?, ?, ?, 'https://example.com/', 'https://example.com/', 'Guide', 'Guide', ?, ?, 400, 200, 1, ?)`,
    newId("pg"),
    tenantId,
    websiteId,
    runId,
    JSON.stringify(HEADINGS),
    [...HEADINGS.map((h) => h.text), ...primaryKeywords].join(" "),
    now
  );

  return { tenantId, websiteId, runId };
}

function keywordCount(tenantId: string): number {
  return (
    all<{ n: number }>("SELECT COUNT(*) AS n FROM keywords WHERE tenant_id = ?", tenantId)[0]?.n ?? 0
  );
}

describe("keyword tracking allowance", () => {
  it("keeps discovered keywords within the plan limit", () => {
    const cap = getLimits("free").keywords;
    const fx = makeCrawl("free");
    const result = analyzeRun({ ...fx, plan: "free" });

    expect(keywordCount(fx.tenantId)).toBeLessThanOrEqual(cap);
    expect(result.keywords).toBeLessThanOrEqual(cap);
  });

  it("flags that the cap cut the list short instead of hiding it", () => {
    const fx = makeCrawl("free");
    const result = analyzeRun({ ...fx, plan: "free" });

    expect(keywordCount(fx.tenantId)).toBe(getLimits("free").keywords);
    expect(result.keywordCapHit).toBe(true);
  });

  it("lets a higher plan track more than the free plan", () => {
    const free = makeCrawl("free");
    analyzeRun({ ...free, plan: "free" });
    const growth = makeCrawl("growth");
    analyzeRun({ ...growth, plan: "growth" });

    expect(keywordCount(growth.tenantId)).toBeGreaterThan(keywordCount(free.tenantId));
  });

  it("counts the tenant's existing keywords against the allowance", () => {
    const fx = makeCrawl("free");
    const cap = getLimits("free").keywords;
    // Simulate a tenant already at its ceiling from an earlier crawl.
    const now = nowIso();
    for (let i = 0; i < cap; i++) {
      run(
        `INSERT INTO keywords (id, tenant_id, website_id, term, source, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'crawl', ?, ?)`,
        newId("kw"),
        fx.tenantId,
        fx.websiteId,
        `pre-existing term ${i}`,
        now,
        now
      );
    }
    expect(keywordCount(fx.tenantId)).toBe(cap);

    const result = analyzeRun({ ...fx, plan: "free" });
    expect(result.keywords).toBe(0);
    expect(keywordCount(fx.tenantId)).toBe(cap);
  });

  it("still refreshes already-tracked terms after the allowance is spent", () => {
    const fx = makeCrawl("free");
    const cap = getLimits("free").keywords;
    const now = nowIso();
    // The phrases `deriveTerms` will look up, already tracked but stale (0 hits).
    const tracked = [
      "alpha keyword",
      "keyword topic",
      "topic number",
      "alpha keyword topic",
      "keyword topic number",
    ];
    const filler = Array.from(
      { length: cap - tracked.length },
      (_, i) => `filler term ${i}`
    );
    for (const term of [...tracked, ...filler]) {
      run(
        `INSERT INTO keywords (id, tenant_id, website_id, term, source, occurrences, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'crawl', 0, ?, ?)`,
        newId("kw"),
        fx.tenantId,
        fx.websiteId,
        term,
        now,
        now
      );
    }
    expect(keywordCount(fx.tenantId)).toBe(cap);

    const result = analyzeRun({ ...fx, plan: "free" });

    const refreshed = all<{ term: string; occurrences: number }>(
      "SELECT term, occurrences FROM keywords WHERE tenant_id = ? AND term IN (?, ?, ?, ?, ?)",
      fx.tenantId,
      ...tracked
    );
    expect(result.keywords).toBe(0);
    expect(keywordCount(fx.tenantId)).toBe(cap);
    expect(refreshed.length).toBe(tracked.length);
    for (const r of refreshed) expect(r.occurrences).toBeGreaterThan(0);
  });
});
