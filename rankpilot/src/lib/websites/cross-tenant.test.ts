import { mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Inside the run's scratch directory so the suite teardown removes it. A bare
// mkdtempSync here leaked a directory on every test run.
const dir = join(process.env.RANKPILOT_TEST_DIR ?? tmpdir(), `xtenant-${randomUUID()}`);
mkdirSync(dir, { recursive: true });
process.env.RANKPILOT_DB_PATH = join(dir, "xtenant.db");

import { beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { all, newId, nowIso, row, run } from "@/lib/db/db";
import { buildSession, hashToken, newSid } from "@/lib/auth/session";

/**
 * Cross-tenant isolation at the HTTP boundary.
 *
 * `websites/tenancy.test.ts` proves the repos and queries are scoped. This
 * suite proves the *route handlers* are, by invoking them with a real signed
 * session cookie for org A and then aiming them at org B's ids.
 *
 * `getSession()` reads `cookies()` from `next/headers`, so the cookie store is
 * mocked and the active token is switched per request.
 */

let activeToken: string | null = null;

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      activeToken && name === "rankpilot_session" ? { name, value: activeToken } : undefined,
  }),
}));

// Imported after the mock so the handlers pick it up.
const { GET: getContent, PATCH: patchContent } = await import("@/app/api/content/[contentId]/route");
const { GET: getIssue, PATCH: patchIssue } = await import("@/app/api/issues/[id]/route");
const { PATCH: patchAction } = await import("@/app/api/actions/[id]/route");
const { GET: getWebsiteDetail, PATCH: patchWebsite, DELETE: deleteWebsite } = await import(
  "@/app/api/websites/[id]/route"
);
const { GET: getVersions } = await import("@/app/api/content/[contentId]/versions/route");
const { POST: repurpose } = await import("@/app/api/content/repurpose/route");

function makeOrgUser(name: string): { orgId: string; userId: string; token: string } {
  const orgId = newId("org");
  const userId = newId("usr");
  const sid = newSid();
  const now = nowIso();

  run(
    "INSERT INTO organizations (id, name, slug, plan, created_at, updated_at) VALUES (?, ?, ?, 'pro', ?, ?)",
    orgId,
    `${name} Org`,
    `${name.toLowerCase()}-${orgId.slice(-6)}`,
    now,
    now
  );
  run(
    "INSERT INTO users (id, email, name, password_hash, created_at, updated_at) VALUES (?, ?, ?, 'x', ?, ?)",
    userId,
    `${name.toLowerCase()}@example.com`,
    name,
    now,
    now
  );
  run(
    "INSERT INTO memberships (id, tenant_id, user_id, role, created_at) VALUES (?, ?, ?, 'owner', ?)",
    newId("mbr"),
    orgId,
    userId,
    now
  );

  const token = buildSession({ userId, orgId, sid });
  run(
    `INSERT INTO sessions (id, tenant_id, user_id, token_hash, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    sid,
    orgId,
    userId,
    hashToken(token),
    new Date(Date.now() + 86_400_000).toISOString(),
    now
  );

  return { orgId, userId, token };
}

function makeWebsite(tenantId: string, url: string): string {
  const id = newId("ws");
  const now = nowIso();
  run(
    `INSERT INTO websites (id, tenant_id, name, url, normalized_url, competitor_urls, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, '[]', ?, ?)`,
    id,
    tenantId,
    "Secret Site",
    url,
    url,
    now,
    now
  );
  return id;
}

function makeContent(tenantId: string, websiteId: string): string {
  const id = newId("cnt");
  const now = nowIso();
  run(
    `INSERT INTO content (id, tenant_id, website_id, type, title, slug, body, meta, status, channel, created_at, updated_at)
     VALUES (?, ?, ?, 'article', 'Org B secret title', 'org-b-secret', 'Org B confidential body text.', '{}',
             'approved', 'web', ?, ?)`,
    id,
    tenantId,
    websiteId,
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
     VALUES (?, ?, ?, 'T001', 'technical', 'high', 'org b issue', ?, ?, ?, ?)`,
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

function makeAction(tenantId: string, websiteId: string): string {
  const id = newId("act");
  const now = nowIso();
  run(
    `INSERT INTO actions (id, tenant_id, website_id, title, description, priority, impact, effort,
       status, source, created_at, updated_at)
     VALUES (?, ?, ?, 'org b action', '', 'medium', 'medium', 'low', 'new', 'manual', ?, ?)`,
    id,
    tenantId,
    websiteId,
    now,
    now
  );
  return id;
}

function makeVersion(tenantId: string, contentId: string): string {
  const id = newId("cv");
  run(
    `INSERT INTO content_versions (id, tenant_id, content_id, version, title, body, meta, changes, source, status, created_at)
     VALUES (?, ?, ?, 1, 'v1', 'v1 body', '{}', '[]', 'manual', 'draft', ?)`,
    id,
    tenantId,
    contentId,
    nowIso()
  );
  return id;
}

function req(path: string, init: { method?: string; body?: string } = {}): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    method: init.method ?? "GET",
    body: init.body,
  });
}

function jsonBody(data: unknown): { method: string; body: string } {
  return { method: "POST", body: JSON.stringify(data) };
}
function patchBody(data: unknown): { method: string; body: string } {
  return { method: "PATCH", body: JSON.stringify(data) };
}

const ctxFor = (id: string) => ({ params: Promise.resolve({ id }) });
const contentCtx = (contentId: string) => ({ params: Promise.resolve({ contentId }) });

let A: ReturnType<typeof makeOrgUser>;
let B: ReturnType<typeof makeOrgUser>;
let bWebsite: string;
let bContent: string;
let bIssue: string;
let bAction: string;
let bVersion: string;

beforeAll(() => {
  A = makeOrgUser("alpha");
  B = makeOrgUser("bravo");
  bWebsite = makeWebsite(B.orgId, "https://bravo.example/secret");
  bContent = makeContent(B.orgId, bWebsite);
  bIssue = makeIssue(B.orgId, bWebsite);
  bAction = makeAction(B.orgId, bWebsite);
  bVersion = makeVersion(B.orgId, bContent);
});

describe("cross-tenant isolation at the route boundary", () => {
  it("rejects every request with no session cookie", async () => {
    activeToken = null;
    const res = await getContent(req(`/api/content/${bContent}`), contentCtx(bContent));
    expect(res.status).toBe(401);
  });

  it("404s (never 200) when org A reads org B content by id", async () => {
    activeToken = A.token;
    const res = await getContent(req(`/api/content/${bContent}`), contentCtx(bContent));
    expect(res.status).toBe(404);
    const text = await res.text();
    expect(text).not.toContain("Org B secret title");
    expect(text).not.toContain("Org B confidential body");
  });

  it("404s when org A patches org B content", async () => {
    activeToken = A.token;
    const res = await patchContent(
      req(`/api/content/${bContent}`, patchBody({ status: "approved" })),
      contentCtx(bContent)
    );
    expect(res.status).toBe(404);
    // Row must be untouched.
    const after = row<{ status: string; title: string }>(
      "SELECT status, title FROM content WHERE id = ?",
      bContent
    );
    expect(after?.status).toBe("approved");
    expect(after?.title).toBe("Org B secret title");
  });

  it("404s when org A repurposes org B content", async () => {
    activeToken = A.token;
    const res = await repurpose(
      req("/api/content/repurpose", jsonBody({ contentId: bContent, formats: ["linkedin"] }))
    );
    expect(res.status).toBe(404);
    const leaked = all<{ n: number }>(
      "SELECT COUNT(*) AS n FROM content WHERE source_content_id = ?",
      bContent
    );
    expect(leaked[0].n).toBe(0);
  });

  it("404s when org A lists org B content versions", async () => {
    activeToken = A.token;
    const res = await getVersions(req(`/api/content/${bContent}/versions`), contentCtx(bContent));
    expect(res.status).toBe(404);
    expect(await res.text()).not.toContain("v1 body");
  });

  it("404s when org A reads or patches org B issue", async () => {
    activeToken = A.token;
    const read = await getIssue(req(`/api/issues/${bIssue}`), ctxFor(bIssue));
    expect(read.status).toBe(404);

    const patched = await patchIssue(
      req(`/api/issues/${bIssue}`, patchBody({ status: "resolved" })),
      ctxFor(bIssue)
    );
    expect(patched.status).toBe(404);
    const after = row<{ status: string }>("SELECT status FROM seo_issues WHERE id = ?", bIssue);
    expect(after?.status).toBe("new");
  });

  it("404s when org A patches org B action", async () => {
    activeToken = A.token;
    const res = await patchAction(
      req(`/api/actions/${bAction}`, patchBody({ status: "in_progress" })),
      ctxFor(bAction)
    );
    expect(res.status).toBe(404);
    const after = row<{ status: string }>("SELECT status FROM actions WHERE id = ?", bAction);
    expect(after?.status).toBe("new");
  });

  it("404s on read, update and delete of org B website", async () => {
    activeToken = A.token;
    expect((await getWebsiteDetail(req(`/api/websites/${bWebsite}`), ctxFor(bWebsite))).status).toBe(404);
    expect(
      (await patchWebsite(req(`/api/websites/${bWebsite}`, patchBody({ name: "stolen" })), ctxFor(bWebsite)))
        .status
    ).toBe(404);
    expect((await deleteWebsite(req(`/api/websites/${bWebsite}`), ctxFor(bWebsite))).status).toBe(404);

    const after = row<{ name: string; deleted_at: string | null }>(
      "SELECT name, deleted_at FROM websites WHERE id = ?",
      bWebsite
    );
    expect(after?.name).toBe("Secret Site");
    expect(after?.deleted_at).toBeNull();
  });

  it("still lets org B reach its own data", async () => {
    activeToken = B.token;
    const res = await getContent(req(`/api/content/${bContent}`), contentCtx(bContent));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(JSON.stringify(body)).toContain("Org B secret title");

    const versions = await getVersions(req(`/api/content/${bContent}/versions`), contentCtx(bContent));
    expect(versions.status).toBe(200);
    expect(JSON.stringify(await versions.json())).toContain(bVersion);
  });

  it("does not write an audit row for a rejected cross-tenant attempt", async () => {
    activeToken = A.token;
    const before = row<{ n: number }>("SELECT COUNT(*) AS n FROM audit_logs")?.n ?? 0;
    await patchAction(
      req(`/api/actions/${bAction}`, patchBody({ status: "completed" })),
      ctxFor(bAction)
    );
    const after = row<{ n: number }>("SELECT COUNT(*) AS n FROM audit_logs")?.n ?? 0;
    expect(after).toBe(before);
  });
});
