import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getDb, closeDb, run, newId, nowIso } from "@/lib/db/db";
import { recipientsFor } from "./engine";

let dir: string;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "creatoros-email-test-"));
  process.env.CREATOROS_DB_PATH = join(dir, "test.db");
  getDb();
  run("INSERT INTO organizations (id, name, slug, plan, created_at, updated_at) VALUES (?, 'Test', 'test-email-org', 'creator', ?, ?)", TENANT, nowIso(), nowIso());
});

afterAll(() => {
  closeDb();
  rmSync(dir, { recursive: true, force: true });
});

const TENANT = "org_email_test";

function seedContact(email: string, consent: number): string {
  const id = newId("con");
  run("INSERT INTO contacts (id, tenant_id, email, name, consent, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, '[]', ?, ?)", id, TENANT, email, `Name of ${email}`, consent, nowIso(), nowIso());
  return id;
}

describe("email engine recipient selection", () => {
  it("returns only consented contacts", () => {
    const ok = seedContact("a@example.com", 1);
    seedContact("b@example.com", 0);
    const recips = recipientsFor(TENANT);
    expect(recips.map((r) => r.id)).toContain(ok);
    expect(recips.every((r) => r.email !== "b@example.com")).toBe(true);
  });

  it("excludes unsubscribed emails", () => {
    seedContact("c@example.com", 1);
    run("INSERT INTO unsubscribes (id, tenant_id, email, created_at) VALUES (?, ?, ?, ?)", newId("uns"), TENANT, "c@example.com", nowIso());
    const recips = recipientsFor(TENANT);
    expect(recips.some((r) => r.email === "c@example.com")).toBe(false);
  });

  it("filters by list membership when a list is given", () => {
    const member = seedContact("member@example.com", 1);
    seedContact("outside@example.com", 1);
    const listId = newId("eml");
    run("INSERT INTO email_lists (id, tenant_id, name, created_at) VALUES (?, ?, 'seg', ?)", listId, TENANT, nowIso());
    run("INSERT INTO email_list_members (id, tenant_id, list_id, contact_id, created_at) VALUES (?, ?, ?, ?, ?)", newId("emmb"), TENANT, listId, member, nowIso());
    const recips = recipientsFor(TENANT, listId);
    expect(recips.map((r) => r.id)).toEqual([member]);
  });
});