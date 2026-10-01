import { afterEach, describe, expect, it } from "vitest";
import { getDb, newId, nowIso, run } from "@/lib/db/db";
import {
  assertCascadesEnabled,
  eraseUser,
  foreignKeysEnabled,
  pendingErasureSummary,
  purgeTenant,
  tenantsPendingErasure,
} from "./erasure";

/**
 * Erasure.
 *
 * The failure that matters here is a silent partial purge: a function that
 * reports success, throws nothing, and leaves customer rows behind. So these
 * tests assert on what is *gone*, not on what the function returned, and they
 * cover the three tables that have no foreign key to save them.
 */

/**
 * Fixtures are tracked and torn down individually.
 *
 * Every test file shares one SQLite file and vitest runs files in parallel, so
 * a blanket `DELETE FROM users` in beforeEach deletes rows another suite is
 * mid-test on. That produced a FOREIGN KEY failure in the password-reset suite.
 * Cleanup here removes only what this file created.
 */
const created: Array<{ orgId: string; userId: string }> = [];

afterEach(() => {
  while (created.length > 0) {
    const { orgId, userId } = created.pop() as { orgId: string; userId: string };
    // No-cascade tables first, then the org (which cascades the rest), then the
    // user. Order matters only in that the FK children must go first.
    run("DELETE FROM jobs WHERE tenant_id = ?", orgId);
    run("DELETE FROM ai_usage WHERE tenant_id = ?", orgId);
    run("DELETE FROM audit_logs WHERE tenant_id = ?", orgId);
    run("DELETE FROM organizations WHERE id = ?", orgId);
    run("DELETE FROM users WHERE id = ?", userId);
  }
});

function seedTenant(name: string) {
  const orgId = newId("org");
  const userId = newId("usr");
  // Unique per invocation. A fixed email would collide with residue from an
  // earlier aborted run, or with a parallel test file, and fail on
  // `UNIQUE constraint failed: users.email` before the test body even ran.
  const email = `${name}-${orgId}@example.com`;
  created.push({ orgId, userId });
  run(
    "INSERT INTO organizations (id, name, slug, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
    orgId,
    name,
    `${name}-${orgId}`,
    nowIso(),
    nowIso()
  );
  run(
    "INSERT INTO users (id, email, name, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    userId,
    email,
    name,
    "hash-not-a-real-password",
    nowIso(),
    nowIso()
  );
  run(
    "INSERT INTO memberships (id, tenant_id, user_id, role, created_at) VALUES (?, ?, ?, ?, ?)",
    newId("mem"),
    orgId,
    userId,
    "owner",
    nowIso()
  );
  // Cascades via organizations
  run(
    "INSERT INTO websites (id, tenant_id, name, url, normalized_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    newId("web"),
    orgId,
    name,
    "https://example.com",
    "https://example.com",
    nowIso(),
    nowIso()
  );
  // No foreign key on tenant_id: these would survive as orphans
  run(
    "INSERT INTO jobs (id, tenant_id, type, status, run_at, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    newId("job"),
    orgId,
    "crawl",
    "queued",
    nowIso(),
    nowIso()
  );
  run(
    "INSERT INTO ai_usage (id, tenant_id, task, model, prompt_version, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    newId("aiu"),
    orgId,
    "content",
    "test",
    "v1",
    nowIso()
  );
  run(
    "INSERT INTO audit_logs (id, tenant_id, user_id, action, meta, ip, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    newId("log"),
    orgId,
    userId,
    "report.exported",
    JSON.stringify({ reportId: "rep_1", email, ip: "9.9.9.9" }),
    "9.9.9.9",
    nowIso()
  );
  return { orgId, userId, email };
}

function count(table: string, where: string, ...params: string[]): number {
  const r = getDb()
    .prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${where}`)
    .get(...params) as { n: number };
  return r.n;
}

describe("erasure preconditions", () => {
  it("has foreign keys enabled, or cascades cannot work", () => {
    expect(foreignKeysEnabled()).toBe(true);
  });

  it("refuses to run with cascades disabled", () => {
    // Without this, erasure deletes the organization row, cascades do nothing,
    // and the function reports success while leaving every child row orphaned.
    // Turning the pragma off is connection-wide, so it is restored in a
    // finally block or it would silently disable cascades for later tests.
    getDb().exec("PRAGMA foreign_keys = OFF");
    try {
      expect(foreignKeysEnabled()).toBe(false);
      expect(() => assertCascadesEnabled()).toThrow(/foreign_keys/);
    } finally {
      getDb().exec("PRAGMA foreign_keys = ON");
    }
    expect(foreignKeysEnabled()).toBe(true);
  });

  it("warns rather than silently claiming success when cascades are off", () => {
    const { orgId } = seedTenant("acme");
    getDb().exec("PRAGMA foreign_keys = OFF");
    try {
      const dry = purgeTenant(orgId, { dryRun: true });
      expect(dry.warning).toMatch(/foreign keys are off/);
    } finally {
      getDb().exec("PRAGMA foreign_keys = ON");
    }
  });

  it("refuses to purge for real when cascades are disabled", () => {
    // Covers the guard by its effect on erasure, not just the helper: if the
    // call to assertCascadesEnabled() is deleted, this must still fail rather
    // than delete the organization and orphan every child row.
    const { orgId } = seedTenant("acme");
    getDb().exec("PRAGMA foreign_keys = OFF");
    try {
      expect(() => purgeTenant(orgId)).toThrow(/foreign_keys/);
      expect(count("organizations", "id = ?", orgId)).toBe(1);
    } finally {
      getDb().exec("PRAGMA foreign_keys = ON");
    }
  });

  it("refuses to erase a user for real when cascades are disabled", () => {
    const { userId, email } = seedTenant("acme");
    getDb().exec("PRAGMA foreign_keys = OFF");
    try {
      expect(() => eraseUser(userId)).toThrow(/foreign_keys/);
      expect(count("users", "id = ?", userId)).toBe(1);
    } finally {
      getDb().exec("PRAGMA foreign_keys = ON");
    }
  });
});

describe("purgeTenant", () => {
  it("removes the organization and every cascaded child", () => {
    const { orgId } = seedTenant("acme");
    purgeTenant(orgId);

    expect(count("organizations", "id = ?", orgId)).toBe(0);
    expect(count("memberships", "tenant_id = ?", orgId)).toBe(0);
    expect(count("websites", "tenant_id = ?", orgId)).toBe(0);
  });

  it("removes the tables that have no foreign key to cascade", () => {
    const { orgId } = seedTenant("acme");
    // These are the three that survive a naive `DELETE FROM organizations`.
    expect(count("jobs", "tenant_id = ?", orgId)).toBe(1);
    expect(count("ai_usage", "tenant_id = ?", orgId)).toBe(1);

    purgeTenant(orgId);

    expect(count("jobs", "tenant_id = ?", orgId)).toBe(0);
    expect(count("ai_usage", "tenant_id = ?", orgId)).toBe(0);
  });

  it("keeps the audit trail but strips the identity from it", () => {
    const { orgId, userId, email } = seedTenant("acme");
    purgeTenant(orgId);

    const log = getDb()
      .prepare("SELECT user_id, ip, meta, action, tenant_id FROM audit_logs WHERE tenant_id = ?")
      .get(orgId) as { user_id: string | null; ip: string | null; meta: string; action: string; tenant_id: string };
    expect(log).toBeTruthy();
    // The security record survives...
    expect(log.action).toBe("report.exported");
    expect(log.tenant_id).toBe(orgId);
    // ...but nothing identifying a person does.
    expect(log.user_id).toBeNull();
    expect(log.ip).toBeNull();
    expect(log.meta).not.toContain(email);
    expect(log.meta).not.toContain("9.9.9.9");
    // Non-identifying context is kept.
    expect(JSON.parse(log.meta).reportId).toBe("rep_1");
    expect(userId).toBeTruthy();
  });

  it("does not touch another tenant", () => {
    const a = seedTenant("acme");
    const b = seedTenant("globex");
    purgeTenant(a.orgId);

    expect(count("organizations", "id = ?", b.orgId)).toBe(1);
    expect(count("websites", "tenant_id = ?", b.orgId)).toBe(1);
    expect(count("jobs", "tenant_id = ?", b.orgId)).toBe(1);
    expect(count("audit_logs", "tenant_id = ?", b.orgId)).toBe(1);
  });

  it("is a no-op for an unknown tenant", () => {
    const { orgId } = seedTenant("acme");
    const result = purgeTenant("org_does_not_exist");
    expect(result.deleted).toEqual({});
    expect(count("organizations", "id = ?", orgId)).toBe(1);
  });

  it("changes nothing on a dry run", () => {
    const { orgId } = seedTenant("acme");
    const result = purgeTenant(orgId, { dryRun: true });

    expect(result.dryRun).toBe(true);
    // It reports the work it would do...
    expect(result.deleted.jobs).toBe(1);
    expect(result.deleted.ai_usage).toBe(1);
    // ...without doing any of it.
    expect(count("organizations", "id = ?", orgId)).toBe(1);
    expect(count("jobs", "tenant_id = ?", orgId)).toBe(1);
    expect(count("ai_usage", "tenant_id = ?", orgId)).toBe(1);
  });

  it("survives a malformed meta blob instead of throwing", () => {
    const { orgId } = seedTenant("acme");
    run("UPDATE audit_logs SET meta = 'not json' WHERE tenant_id = ?", orgId);
    expect(() => purgeTenant(orgId)).not.toThrow();
    const log = getDb().prepare("SELECT meta FROM audit_logs WHERE tenant_id = ?").get(orgId) as { meta: string };
    expect(log.meta).toBe("{}");
  });
});

describe("eraseUser", () => {
  it("removes the user and their session-linked rows", () => {
    const { orgId, userId, email } = seedTenant("acme");
    run(
      "INSERT INTO sessions (id, tenant_id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      newId("ses"),
      orgId,
      userId,
      "hash",
      new Date(Date.now() + 86_400_000).toISOString(),
      nowIso()
    );
    eraseUser(userId);

    expect(count("users", "id = ?", userId)).toBe(0);
    expect(count("sessions", "user_id = ?", userId)).toBe(0);
    expect(count("memberships", "user_id = ?", userId)).toBe(0);
    // The tenant and its other data are untouched.
    expect(count("organizations", "id = ?", orgId)).toBe(1);
    expect(count("websites", "tenant_id = ?", orgId)).toBe(1);
  });

  it("anonymizes that user's audit entries while keeping other users'", () => {
    const a = seedTenant("acme");
    const b = seedTenant("globex");
    eraseUser(a.userId);

    const aLog = getDb().prepare("SELECT user_id, ip, meta FROM audit_logs WHERE tenant_id = ?").get(a.orgId) as {
      user_id: string | null;
      ip: string | null;
      meta: string;
    };
    expect(aLog.user_id).toBeNull();
    // Regression: `user_id` is nulled first, so an ip update keyed on
    // `WHERE user_id = ?` matched nothing and left the address in place.
    expect(aLog.ip).toBeNull();
    expect(aLog.meta).not.toContain(a.email);

    const bLog = getDb().prepare("SELECT user_id FROM audit_logs WHERE tenant_id = ?").get(b.orgId) as {
      user_id: string | null;
    };
    expect(bLog.user_id).toBe(b.userId);
  });

  it("scrubs identifying keys nested inside meta", () => {
    const a = seedTenant("acme");
    run(
      "UPDATE audit_logs SET meta = ? WHERE tenant_id = ?",
      JSON.stringify({
        reportId: "rep_1",
        contact: { email: a.email, name: "Acme", plan: "pro" },
        targets: [{ userAgent: "Mozilla/5.0 (secret fingerprint)" }, { url: "https://x.test" }],
      }),
      a.orgId
    );

    eraseUser(a.userId);

    const row = getDb().prepare("SELECT meta FROM audit_logs WHERE tenant_id = ?").get(a.orgId) as {
      meta: string;
    };
    // Regression: a top-level-only scrub left these intact while still
    // recording the erasure as done.
    expect(row.meta).not.toContain(a.email);
    expect(row.meta).not.toContain("secret fingerprint");
    // Non-identifying context at depth is preserved. Note `name` is itself a
    // PII key, so the check uses a value that is not identifying.
    const parsed = JSON.parse(row.meta) as Record<string, unknown>;
    expect(parsed.reportId).toBe("rep_1");
    expect((parsed.contact as Record<string, unknown>).name).toBeUndefined();
    expect((parsed.contact as Record<string, unknown>).plan).toBe("pro");
    expect(parsed.targets).toEqual([{}, { url: "https://x.test" }]);
  });

  it("is a no-op for an unknown user", () => {
    const { orgId } = seedTenant("acme");
    const result = eraseUser("usr_nope");
    expect(result.deleted).toEqual({});
    expect(count("organizations", "id = ?", orgId)).toBe(1);
  });

  it("changes nothing on a dry run", () => {
    const { userId, email } = seedTenant("acme");
    eraseUser(userId, { dryRun: true });
    expect(count("users", "id = ?", userId)).toBe(1);
  });
});

describe("erasure queue", () => {
  it("lists soft-deleted tenants so an unprocessed erasure is visible", () => {
    const a = seedTenant("acme");
    const b = seedTenant("globex");
    run("UPDATE organizations SET deleted_at = ? WHERE id = ?", nowIso(), a.orgId);

    const pending = tenantsPendingErasure();
    // Contains, not equals: the shared test database may hold soft-deleted
    // tenants left by another suite, and the behaviour under test is "this
    // tenant appears, and live ones do not".
    expect(pending.map((t) => t.id)).toContain(a.orgId);
    expect(pending.map((t) => t.id)).not.toContain(b.orgId);
    const mine = pending.find((t) => t.id === a.orgId);
    expect(mine?.deletedAt).toBeTruthy();
    expect(count("organizations", "id = ?", b.orgId)).toBe(1);
  });
});
