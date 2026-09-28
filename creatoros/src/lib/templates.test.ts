import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getDb, closeDb, run, row, nowIso } from "@/lib/db/db";
import { TEMPLATE_CATALOG, TEMPLATE_CATEGORIES, listTemplates, getTemplate, applyTemplate } from "./templates";

let dir: string;
const TENANT = "org_tpl_test";
const USER = "usr_tpl_test";
const PROFILE = "prof_tpl_test";

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "creatoros-tpl-test-"));
  process.env.CREATOROS_DB_PATH = join(dir, "test.db");
  getDb();
  run("INSERT INTO organizations (id, name, slug, plan, created_at, updated_at) VALUES (?, 'Tpl', 'tpl-org', 'creator', ?, ?)", TENANT, nowIso(), nowIso());
  run("INSERT INTO users (id, email, password_hash, name, created_at, updated_at) VALUES (?, ?, 'x', 'Tpl', ?, ?)", USER, "tpl@test.dev", nowIso(), nowIso());
  run("INSERT INTO profiles (id, tenant_id, user_id, username, created_at, updated_at) VALUES (?, ?, ?, 'tpluser', ?, ?)", PROFILE, TENANT, USER, nowIso(), nowIso());
});

afterAll(() => {
  closeDb();
  rmSync(dir, { recursive: true, force: true });
});

function cleanTenant() {
  run("DELETE FROM bio_pages WHERE tenant_id = ?", TENANT);
  run("DELETE FROM bio_blocks WHERE tenant_id = ?", TENANT);
  run("DELETE FROM plans_usage WHERE tenant_id = ?", TENANT);
}

describe("templates", () => {
  it("catalog has valid entries for every category", () => {
    expect(TEMPLATE_CATALOG.length).toBeGreaterThanOrEqual(20);
    for (const t of TEMPLATE_CATALOG) {
      expect(t.id).toMatch(/^tmpl-/);
      expect(t.name.length).toBeGreaterThan(0);
      expect(TEMPLATE_CATEGORIES).toContain(t.category);
      expect(t.blocks.length).toBeGreaterThan(0);
      expect(t.theme.accent).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it("catalogs both free and premium templates", () => {
    expect(TEMPLATE_CATALOG.some((t) => t.premium)).toBe(true);
    expect(TEMPLATE_CATALOG.some((t) => !t.premium)).toBe(true);
  });

  it("filters by category and search query", () => {
    expect(listTemplates("social").every((t) => t.category === "social")).toBe(true);
    expect(listTemplates(undefined, "coach").length).toBeGreaterThan(0);
    expect(listTemplates(undefined, "zzzz-nothing").length).toBe(0);
  });

  it("resolves templates by id", () => {
    const t = getTemplate("tmpl-social-linktree");
    expect(t?.name).toBe("Link-in-Bio Starter");
    expect(getTemplate("nope")).toBeUndefined();
  });

  it("applies a template: creates page + blocks, bumps bio page usage", () => {
    cleanTenant();

    const r = applyTemplate({ tenantId: TENANT, profileId: PROFILE, plan: "creator", templateId: "tmpl-social-linktree", title: "Applied", slug: "applied" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const page = row<{ title: string; published: number }>("SELECT title, published FROM bio_pages WHERE id = ?", r.pageId);
    expect(page?.title).toBe("Applied");
    expect(page?.published).toBe(0);
    const blockCount = row<{ c: number }>("SELECT COUNT(*) AS c FROM bio_blocks WHERE page_id = ?", r.pageId)?.c;
    expect(blockCount).toBe(5);
  });

  it("rejects premium templates on the free plan and unknown ids", () => {
    cleanTenant();

    const r1 = applyTemplate({ tenantId: TENANT, profileId: PROFILE, plan: "free", templateId: "tmpl-social-viralkit" });
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.code).toBe("premium");

    const r2 = applyTemplate({ tenantId: TENANT, profileId: PROFILE, plan: "creator", templateId: "nope" });
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.code).toBe("not_found");
  });

  it("holds the line at the bio page quota for the plan", () => {
    cleanTenant();
    const limit = 3;
    for (let i = 0; i < limit + 1; i++) {
      const r = applyTemplate({ tenantId: TENANT, profileId: PROFILE, plan: "creator", templateId: "tmpl-business-consultant", title: `P${i}`, slug: `p${i}` });
      if (i < limit) expect(r.ok).toBe(true);
      else {
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.code).toBe("quota");
      }
    }
  });
});