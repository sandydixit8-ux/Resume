import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// A database of its own, so these tests cannot be perturbed by anything else.
// Placed inside the run's scratch directory when there is one, so the run's
// teardown removes it. The previous unconditional mkdtempSync here leaked a
// directory on every test run. `getDb()` reads the path lazily, so assigning
// this before the first query is enough despite import hoisting.
const worker = process.env.VITEST_WORKER_ID ?? process.env.VITEST_POOL_ID ?? "1";
process.env.RANKPILOT_DB_PATH = join(
  process.env.RANKPILOT_TEST_DIR ?? mkdtempSync(join(tmpdir(), "rankpilot-test-")),
  `tenancy-${worker}.db`
);

import { describe, expect, it, beforeAll } from "vitest";
import { newId, nowIso, row, run, all } from "@/lib/db/db";
import { getWebsite, listWebsites, countWebsites } from "@/lib/websites/repo";

function makeOrg(name: string): string {
  const id = newId("org");
  const now = nowIso();
  run(
    "INSERT INTO organizations (id, name, slug, plan, created_at, updated_at) VALUES (?, ?, ?, 'free', ?, ?)",
    id,
    name,
    `${name.toLowerCase()}-${id.slice(-6)}`,
    now,
    now
  );
  return id;
}

function makeWebsite(tenantId: string, url: string): string {
  const id = newId("ws");
  const now = nowIso();
  run(
    `INSERT INTO websites (id, tenant_id, name, url, normalized_url, competitor_urls, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, '[]', ?, ?)`,
    id,
    tenantId,
    "Site",
    url,
    url,
    now,
    now
  );
  return id;
}

function makeIssue(tenantId: string, websiteId: string): string {
  const id = newId("iss");
  const now = nowIso();
  run(
    `INSERT INTO seo_issues (id, tenant_id, website_id, code, category, severity, title,
       first_seen_at, last_seen_at, created_at, updated_at)
     VALUES (?, ?, ?, 'T001', 'technical', 'high', 'missing title', ?, ?, ?, ?)`,
    id,
    tenantId,
    websiteId,
    now,
    now,
    now,
    now
  );
  return id;
}

/** Every Phase 2–6 tenant-scoped table that stores per-website or per-org data. */
function makePhaseTables(tenantId: string, websiteId: string): Record<string, string> {
  const now = nowIso();
  const ids: Record<string, string> = {};

  ids.content = newId("cnt");
  run(
    `INSERT INTO content (id, tenant_id, website_id, type, title, body, meta, status, channel, created_at, updated_at)
     VALUES (?, ?, ?, 'article', 'Draft', 'body', '{}', 'draft', 'web', ?, ?)`,
    ids.content,
    tenantId,
    websiteId,
    now,
    now
  );

  ids.contentVersion = newId("cv");
  run(
    `INSERT INTO content_versions (id, tenant_id, content_id, version, title, body, meta, changes, source, status, created_at)
     VALUES (?, ?, ?, 1, 'Draft', 'body', '{}', '[]', 'manual', 'draft', ?)`,
    ids.contentVersion,
    tenantId,
    ids.content,
    now
  );

  ids.competitor = newId("cmp");
  run(
    "INSERT INTO competitors (id, tenant_id, website_id, url, name, status, overlap_keywords, created_at) VALUES (?, ?, ?, 'https://rival.example', 'Rival', 'pending', 0, ?)",
    ids.competitor,
    tenantId,
    websiteId,
    now
  );

  ids.gap = newId("gap");
  run(
    "INSERT INTO content_gaps (id, tenant_id, website_id, competitor_id, term, status, priority, created_at) VALUES (?, ?, ?, ?, 'topic we miss', 'missing', 'high', ?)",
    ids.gap,
    tenantId,
    websiteId,
    ids.competitor,
    now
  );

  ids.thread = newId("thr");
  run(
    "INSERT INTO copilot_threads (id, tenant_id, website_id, title, created_at, updated_at) VALUES (?, ?, ?, 'Thread', ?, ?)",
    ids.thread,
    tenantId,
    websiteId,
    now,
    now
  );

  ids.message = newId("msg");
  run(
    "INSERT INTO copilot_messages (id, thread_id, role, content, epistemic, created_at) VALUES (?, ?, 'assistant', 'hello', 'observed', ?)",
    ids.message,
    ids.thread,
    now
  );

  ids.experiment = newId("exp");
  run(
    "INSERT INTO experiments (id, tenant_id, website_id, name, hypothesis, metric, status, created_at) VALUES (?, ?, ?, 'Test', 'h', 'ctr', 'draft', ?)",
    ids.experiment,
    tenantId,
    websiteId,
    now
  );

  ids.variant = newId("var");
  run(
    "INSERT INTO experiment_variants (id, experiment_id, label, payload, traffic_pct, created_at) VALUES (?, ?, 'A', '{}', 50, ?)",
    ids.variant,
    ids.experiment,
    now
  );

  ids.visibility = newId("vis");
  run(
    "INSERT INTO ai_visibility (id, tenant_id, website_id, engine, query, brand_mentioned, competitor_mentions, source_urls, checked_at, created_at) VALUES (?, ?, ?, 'chatgpt', 'best tool', NULL, '[]', '[]', ?, ?)",
    ids.visibility,
    tenantId,
    websiteId,
    now,
    now
  );

  ids.client = newId("cli");
  run(
    "INSERT INTO clients (id, tenant_id, name, contact, notes, status, created_at) VALUES (?, ?, 'Acme client', '', '', 'active', ?)",
    ids.client,
    tenantId,
    now
  );

  ids.invoice = newId("inv");
  run(
    "INSERT INTO invoices (id, tenant_id, amount_usd, currency, period, status, created_at) VALUES (?, ?, 99, 'USD', '2026-01', 'paid', ?)",
    ids.invoice,
    tenantId,
    now
  );

  ids.cmsFix = newId("fix");
  run(
    "INSERT INTO cms_fixes (id, tenant_id, website_id, provider, payload, backup_ref, status, created_at) VALUES (?, ?, ?, 'manual', '{}', 'backup-1', 'proposed', ?)",
    ids.cmsFix,
    tenantId,
    websiteId,
    now
  );

  ids.agentRun = newId("agt");
  run(
    "INSERT INTO agent_runs (id, tenant_id, run_date, summary, priorities, opportunities, created_at) VALUES (?, ?, '2026-01-01', 's', '[]', '[]', ?)",
    ids.agentRun,
    tenantId,
    now
  );

  ids.revenue = newId("rev");
  run(
    "INSERT INTO revenue_events (id, tenant_id, website_id, source, label, amount_usd, occurred_at, created_at) VALUES (?, ?, ?, 'organic', 'deal', 10, '2026-01-01', ?)",
    ids.revenue,
    tenantId,
    websiteId,
    now
  );

  ids.schedule = newId("sch");
  run(
    "INSERT INTO crawl_schedules (id, tenant_id, website_id, frequency, enabled, next_run_at, created_at) VALUES (?, ?, ?, 'weekly', 1, ?, ?)",
    ids.schedule,
    tenantId,
    websiteId,
    now,
    now
  );

  return ids;
}

describe("tenant isolation", () => {
  let orgA: string;
  let orgB: string;
  let siteA: string;
  let issueA: string;

  beforeAll(() => {
    orgA = makeOrg("Acme");
    orgB = makeOrg("Globex");
    siteA = makeWebsite(orgA, "https://acme.example");
    issueA = makeIssue(orgA, siteA);
    makeWebsite(orgB, "https://globex.example");
  });

  it("a tenant cannot read another tenant's website, even with its id", () => {
    expect(getWebsite(orgA, siteA)).toBeDefined();
    expect(getWebsite(orgB, siteA)).toBeUndefined();
  });

  it("listing only ever returns the caller's own websites", () => {
    expect(listWebsites(orgA).map((w) => w.id)).toEqual([siteA]);
    expect(listWebsites(orgB).map((w) => w.id)).not.toContain(siteA);
    expect(countWebsites(orgB)).toBe(1);
  });

  it("queries scoped by tenant hide other tenants' issues", () => {
    const visible = row<{ n: number }>(
      "SELECT COUNT(*) AS n FROM seo_issues WHERE tenant_id = ?",
      orgB
    );
    expect(visible?.n).toBe(0);

    const direct = row(
      "SELECT id FROM seo_issues WHERE id = ? AND tenant_id = ?",
      issueA,
      orgB
    );
    expect(direct).toBeUndefined();
  });

  it("status updates scoped by tenant cannot touch another tenant's row", () => {
    const res = run(
      "UPDATE seo_issues SET status = 'resolved' WHERE id = ? AND tenant_id = ?",
      issueA,
      orgB
    );
    expect(res.changes).toBe(0);
    const still = row<{ status: string }>("SELECT status FROM seo_issues WHERE id = ?", issueA);
    expect(still?.status).toBe("new");
  });

  it("soft-deleted websites disappear from every tenant-scoped read", () => {
    const siteB2 = makeWebsite(orgB, "https://globex.example/2");
    run("UPDATE websites SET deleted_at = ? WHERE id = ?", nowIso(), siteB2);
    expect(listWebsites(orgB).map((w) => w.id)).not.toContain(siteB2);
    expect(getWebsite(orgB, siteB2)).toBeUndefined();
  });
});

describe("phase 2-6 tenant isolation", () => {
  /** Tables that carry their own tenant_id. */
  const TABLES = [
    "content",
    "content_versions",
    "competitors",
    "content_gaps",
    "copilot_threads",
    "experiments",
    "ai_visibility",
    "clients",
    "invoices",
    "cms_fixes",
    "agent_runs",
    "revenue_events",
    "crawl_schedules",
  ];

  /** Child tables that intentionally inherit tenancy through a parent row. */
  const CHILD_TABLES = ["copilot_messages", "experiment_variants"];

  let orgA: string;
  let orgB: string;
  let siteA: string;
  let ids: Record<string, string>;

  beforeAll(() => {
    orgA = makeOrg("Globex2");
    orgB = makeOrg("Initech");
    siteA = makeWebsite(orgA, "https://globex2.example");
    ids = makePhaseTables(orgA, siteA);
  });

  it("every phase table carries a tenant_id column", () => {
    for (const t of TABLES) {
      const cols = all<{ name: string }>(`PRAGMA table_info(${t})`);
      expect(cols.map((c) => c.name)).toContain("tenant_id");
    }
  });

  it("child tables inherit tenancy through their parent, never storing their own tenant_id", () => {
    for (const t of CHILD_TABLES) {
      const cols = all<{ name: string }>(`PRAGMA table_info(${t})`).map((c) => c.name);
      expect(cols, `${t} should not duplicate tenant scoping`).not.toContain("tenant_id");
    }
  });

  it("a tenant cannot reach another tenant's child rows through the parent join", () => {
    const messages = row<{ n: number }>(
      `SELECT COUNT(*) AS n FROM copilot_messages m
       JOIN copilot_threads t ON t.id = m.thread_id
       WHERE t.tenant_id = ?`,
      orgB
    );
    expect(messages?.n).toBe(0);

    const variants = row<{ n: number }>(
      `SELECT COUNT(*) AS n FROM experiment_variants v
       JOIN experiments e ON e.id = v.experiment_id
       WHERE e.tenant_id = ?`,
      orgB
    );
    expect(variants?.n).toBe(0);
  });

  it("an unowned parent id cannot be used to read child rows", () => {
    const thread = row<{ id: string }>("SELECT id FROM copilot_threads WHERE id = ? AND tenant_id = ?", ids.thread, orgB);
    expect(thread).toBeUndefined();

    const experiment = row<{ id: string }>("SELECT id FROM experiments WHERE id = ? AND tenant_id = ?", ids.experiment, orgB);
    expect(experiment).toBeUndefined();
  });

  it("the owning tenant can see its own rows", () => {
    for (const t of TABLES) {
      const n = row<{ n: number }>(`SELECT COUNT(*) AS n FROM ${t} WHERE tenant_id = ?`, orgA)?.n ?? 0;
      expect(n, `${t} should be visible to its owner`).toBeGreaterThan(0);
    }
  });

  it("another tenant sees zero rows in every phase table", () => {
    for (const t of TABLES) {
      const n = row<{ n: number }>(`SELECT COUNT(*) AS n FROM ${t} WHERE tenant_id = ?`, orgB)?.n ?? 0;
      expect(n, `${t} leaked rows to another tenant`).toBe(0);
    }
  });

  it("direct reads by id cross the tenant boundary only for the owner", () => {
    expect(row("SELECT id FROM content WHERE id = ? AND tenant_id = ?", ids.content, orgA)).toBeDefined();
    expect(row("SELECT id FROM content WHERE id = ? AND tenant_id = ?", ids.content, orgB)).toBeUndefined();
    expect(row("SELECT id FROM clients WHERE id = ? AND tenant_id = ?", ids.client, orgB)).toBeUndefined();
    expect(row("SELECT id FROM agent_runs WHERE id = ? AND tenant_id = ?", ids.agentRun, orgB)).toBeUndefined();
    expect(row("SELECT id FROM revenue_events WHERE id = ? AND tenant_id = ?", ids.revenue, orgB)).toBeUndefined();
  });

  it("writes scoped by tenant cannot mutate another tenant's rows", () => {
    const content = run("UPDATE content SET status = 'published' WHERE id = ? AND tenant_id = ?", ids.content, orgB);
    expect(content.changes).toBe(0);
    expect(row<{ status: string }>("SELECT status FROM content WHERE id = ?", ids.content)?.status).toBe("draft");

    const revenue = run("DELETE FROM revenue_events WHERE id = ? AND tenant_id = ?", ids.revenue, orgB);
    expect(revenue.changes).toBe(0);
    expect(row("SELECT id FROM revenue_events WHERE id = ?", ids.revenue)).toBeDefined();

    const fix = run("UPDATE cms_fixes SET status = 'applied' WHERE id = ? AND tenant_id = ?", ids.cmsFix, orgB);
    expect(fix.changes).toBe(0);
  });

  it("website-scoped reads hide another tenant's website rows", () => {
    const n = row<{ n: number }>(
      "SELECT COUNT(*) AS n FROM content WHERE website_id = ? AND tenant_id = ?",
      siteA,
      orgB
    );
    expect(n?.n).toBe(0);
  });
});
