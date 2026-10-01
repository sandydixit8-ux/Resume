import { beforeAll, describe, expect, it, vi } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import { all, newId, nowIso, row, run } from "@/lib/db/db";
import { syncSearchConsole, revokeSearchConsole, deadlineDays } from "./sync";

/**
 * Sync tests run against the per-worker temp DB (see vitest.config.ts). Each
 * test creates its own organization + website, then answers the Search Console
 * HTTP calls with a mock fetch. No network ever happens.
 */

const key = generateKeyPairSync("rsa", { modulusLength: 2048 });
const CONFIG = {
  clientEmail: "svc@example.com",
  privateKey: key.privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
};

function makeOrg(): string {
  const id = newId("org");
  const now = nowIso();
  run(
    "INSERT INTO organizations (id, name, slug, plan, created_at, updated_at) VALUES (?, ?, ?, 'free', ?, ?)",
    id,
    "Acme",
    `acme-${id.slice(-6)}`,
    now,
    now
  );
  return id;
}

function makeWebsite(tenantId: string, _idSuffix = "ws1", host = "example.com") {
  const id = newId("ws");
  const now = nowIso();
  run(
    `INSERT INTO websites (id, tenant_id, name, url, normalized_url, competitor_urls, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, '[]', ?, ?)`,
    id,
    tenantId,
    "Test site",
    `https://${host}/`,
    `https://${host}/`,
    now,
    now
  );
  return id;
}

/** The hosts the fixtures below register, so a sync can find its property. */
const READABLE = {
  siteEntry: [
    { siteUrl: "https://example.com/" },
    { siteUrl: "sc-domain:refresh.me" },
    { siteUrl: "sc-domain:no.volume" },
    { siteUrl: "sc-domain:deadline.me" },
    { siteUrl: "sc-domain:revoke.me" },
  ],
};

function fetchWith(
  analytics: { rows?: unknown[] } | null,
  status = 200,
  listSites: { siteEntry: { siteUrl: string }[] } = READABLE
) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    void init;
    if (String(url).endsWith("/token")) {
      return new Response(JSON.stringify({ access_token: "tok_abc" }), { status: 200 });
    }
    if (String(url).endsWith("/sites")) {
      return new Response(JSON.stringify(listSites), { status: 200 });
    }
    // searchAnalytics/query
    return new Response(JSON.stringify(analytics), { status });
  });
}

describe("deadlineDays", () => {
  it("defaults to 3", () => {
    expect(deadlineDays({})).toBe(3);
  });
  it("honours an explicit value and clamps to [0,7]", () => {
    expect(deadlineDays({ GSC_DEADLINE_DAYS: "5" })).toBe(5);
    expect(deadlineDays({ GSC_DEADLINE_DAYS: "99" })).toBe(3);
  });
});

describe("syncSearchConsole", () => {
  let tenantId: string;
  beforeAll(() => {
    tenantId = makeOrg();
  });

  it("imports rows into keywords with source=gsc and returns the window", async () => {
    const websiteId = makeWebsite(tenantId);
    const result = await syncSearchConsole({
      tenantId,
      websiteId,
      config: CONFIG,
      fetchFn: fetchWith({
        rows: [
          { keys: [" seo Tools "], clicks: 12, impressions: 400, ctr: 0.03, position: 9.2 },
          { keys: ["free audit"], clicks: 1, impressions: 10, ctr: 0.1, position: 2.0 },
        ],
      }) as unknown as typeof fetch,
      now: new Date("2026-01-15T12:00:00Z"),
    });
    expect(result.ok).toBe(true);
    expect(result.imported).toBe(2);
    expect(result.siteUrl).toBe("https://example.com/");
    // 27-day window ending 3 days before now (deadline), so the trailing
    // provisional days are reserved.
    expect(result.window.endDate).toBe("2026-01-12");
    expect(result.window.startDate).toBe("2025-12-16");

    const fetched = all<{ term: string; current_rank: number; ctr: number; source: string }>(
      "SELECT term, current_rank, ctr, source FROM keywords WHERE website_id = ? ORDER BY term",
      websiteId
    );
    expect(fetched).toHaveLength(2);
    expect(fetched[0]).toMatchObject({ term: "free audit", current_rank: 2, ctr: 0.1, source: "gsc" });
    expect(fetched[1]).toMatchObject({ term: "seo tools", current_rank: 9.2, ctr: 0.03, source: "gsc" });
  });

  it("refreshes an existing gsc row for the same term instead of duplicating", async () => {
    const websiteId = makeWebsite(tenantId, "ws2", "refresh.me");
    run(
      `INSERT INTO keywords (id, tenant_id, website_id, term, source, intent, occurrences, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'gsc', 'informational', 1, ?, ?)`,
      "kw_existing",
      tenantId,
      websiteId,
      "ranked term",
      nowIso(),
      nowIso()
    );

    const result = await syncSearchConsole({
      tenantId,
      websiteId,
      config: CONFIG,
      fetchFn: fetchWith({
        rows: [{ keys: ["ranked term"], clicks: 5, impressions: 50, ctr: 0.1, position: 4.0 }],
      }) as unknown as typeof fetch,
      now: new Date("2026-01-15T12:00:00Z"),
    });
    expect(result.imported).toBe(1);
    const n = row<{ n: number }>("SELECT COUNT(*) AS n FROM keywords WHERE website_id = ? AND term = ?", websiteId, "ranked term");
    expect(n?.n).toBe(1);
    const updated = row<{ current_rank: number }>("SELECT current_rank FROM keywords WHERE id = 'kw_existing'");
    expect(updated?.current_rank).toBe(4);
  });

  it("never fabricates search volume — volume/difficulty stay NULL", async () => {
    const websiteId = makeWebsite(tenantId, "ws3", "no.volume");
    await syncSearchConsole({
      tenantId,
      websiteId,
      config: CONFIG,
      fetchFn: fetchWith({ rows: [{ keys: ["term"], clicks: 1, impressions: 20, ctr: 0.05, position: 6 }] }) as unknown as typeof fetch,
      now: new Date("2026-01-15T12:00:00Z"),
    });
    const r = row<{ volume: number | null; difficulty: number | null }>(
      "SELECT volume, difficulty FROM keywords WHERE website_id = ?",
      websiteId
    );
    expect(r?.volume).toBeNull();
    expect(r?.difficulty).toBeNull();
  });

  it("returns no_access when the service account cannot see the property", async () => {
    const websiteId = makeWebsite(tenantId, "ws4", "denied.example");
    const result = await syncSearchConsole({
      tenantId,
      websiteId,
      config: CONFIG,
      fetchFn: fetchWith({ rows: [{ keys: ["x"], clicks: 1, impressions: 1, ctr: 1, position: 1 }] }) as unknown as typeof fetch,
      now: new Date("2026-01-15T12:00:00Z"),
    });
    expect(result.problem).toBe("no_access");
    expect(result.imported).toBe(0);
  });

  it("reserves the trailing days via the deadline window", async () => {
    const websiteId = makeWebsite(tenantId, "ws5", "deadline.me");
    const result = await syncSearchConsole({
      tenantId,
      websiteId,
      config: CONFIG,
      fetchFn: fetchWith({ rows: [] }) as unknown as typeof fetch,
      now: new Date("2026-02-10T00:00:00Z"),
    });
    expect(result.deadlineDays).toBe(3);
    expect(result.window.endDate).toBe("2026-02-07");
  });
});

describe("revokeSearchConsole", () => {
  let tenantId: string;
  beforeAll(() => {
    tenantId = makeOrg();
  });

  it("deletes only the gsc source rows for the tenant's websites", () => {
    const websiteId = makeWebsite(tenantId, "ws6", "revoke.me");
    run(
      `INSERT INTO keywords (id, tenant_id, website_id, term, source, intent, occurrences, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'gsc', 'informational', 1, ?, ?)`,
      "rev_a1",
      tenantId,
      websiteId,
      "gsc term 1",
      nowIso(),
      nowIso()
    );
    run(
      `INSERT INTO keywords (id, tenant_id, website_id, term, source, intent, occurrences, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'crawl', 'informational', 1, ?, ?)`,
      "rev_c1",
      tenantId,
      websiteId,
      "crawl term",
      nowIso(),
      nowIso()
    );

    const removed = revokeSearchConsole(tenantId);
    expect(removed).toBeGreaterThanOrEqual(1);
    const gscLeft = row<{ n: number }>("SELECT COUNT(*) AS n FROM keywords WHERE source = 'gsc' AND website_id = ?", websiteId);
    expect(gscLeft?.n).toBe(0);
    const crawlLeft = row<{ n: number }>("SELECT COUNT(*) AS n FROM keywords WHERE id = 'rev_c1'");
    expect(crawlLeft?.n).toBe(1);
  });
});