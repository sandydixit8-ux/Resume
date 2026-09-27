import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getDb, closeDb, run, row, all, nowIso } from "@/lib/db/db";
import { exportAccountData, deleteAccountData, type AccountExport } from "./gdpr";

let dir: string;
const TENANT = "org_gdpr_test";
const USER = "usr_gdpr_test";

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "creatoros-gdpr-test-"));
  process.env.CREATOROS_DB_PATH = join(dir, "test.db");
  getDb();
  run(
    "INSERT INTO organizations (id, name, slug, plan, created_at, updated_at) VALUES (?, 'GDPR Test', 'test-gdpr-org', 'free', ?, ?)",
    TENANT,
    nowIso(),
    nowIso()
  );
  run(
    "INSERT INTO users (id, email, password_hash, name, role, created_at, updated_at) VALUES (?, 'gdpr@example.com', 'hash', 'GDPR Test', 'user', ?, ?)",
    USER,
    nowIso(),
    nowIso()
  );
});

beforeEach(() => {
  run("DELETE FROM audit_logs WHERE tenant_id = ?", TENANT);
  run("DELETE FROM contacts WHERE tenant_id = ?", TENANT);
  run("DELETE FROM memberships WHERE tenant_id = ?", TENANT);
});

afterAll(() => {
  closeDb();
  rmSync(dir, { recursive: true, force: true });
});

describe("account GDPR", () => {
  it("exports org, user and tenant tables without password hashes", () => {
    run("INSERT INTO memberships (id, tenant_id, user_id, role, created_at) VALUES (?, ?, ?, 'owner', ?)", "mem_x", TENANT, USER, nowIso());
    run("INSERT INTO contacts (id, tenant_id, email, name, consent, source, created_at, updated_at) VALUES (?, ?, 'lead@example.com', 'Lead', 1, 'test', ?, ?)", "con_gdpr_1", TENANT, nowIso(), nowIso());

    const data = exportAccountData(TENANT, USER) as AccountExport;

    expect((data.organization as { id: string }).id).toBe(TENANT);
    expect((data.user as { email: string }).email).toBe("gdpr@example.com");
    expect(Object.keys(data.user as object)).not.toContain("password_hash");
    expect(JSON.stringify(data)).not.toContain("password_hash");
    expect(data.memberships as unknown[]).toHaveLength(1);
    expect(data.contacts as unknown[]).toHaveLength(1);
    expect(data.courses as unknown[]).toEqual([]);
  });

  it("deletes the organisation, user and all cascaded tenant data", () => {
    run("INSERT INTO memberships (id, tenant_id, user_id, role, created_at) VALUES (?, ?, ?, 'owner', ?)", "mem_y", TENANT, USER, nowIso());
    run("INSERT INTO contacts (id, tenant_id, email, name, consent, source, created_at, updated_at) VALUES (?, ?, 'lead@example.com', 'Lead', 1, 'test', ?, ?)", "con_gdpr_1", TENANT, nowIso(), nowIso());
    run("INSERT INTO audit_logs (id, tenant_id, user_id, action, created_at) VALUES (?, ?, ?, 'test', ?)", "aud_gdpr_1", TENANT, USER, nowIso());
    run("INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, 'tok', ?, ?)", "ses_gdpr_1", USER, nowIso(), nowIso());

    deleteAccountData(TENANT, USER);

    expect(row("SELECT id FROM organizations WHERE id = ?", TENANT)).toBeUndefined();
    expect(row("SELECT id FROM users WHERE id = ?", USER)).toBeUndefined();
    expect(row("SELECT id FROM contacts WHERE id = ?", "con_gdpr_1")).toBeUndefined();
    expect(row("SELECT id FROM audit_logs WHERE id = ?", "aud_gdpr_1")).toBeUndefined();
    expect(row("SELECT id FROM sessions WHERE id = ?", "ses_gdpr_1")).toBeUndefined();
    expect(all("SELECT id FROM memberships")).toEqual([]);
  });
});