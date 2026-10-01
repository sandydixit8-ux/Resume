import { beforeEach, describe, expect, it } from "vitest";
import { getDb, run, nowIso, newId } from "@/lib/db/db";
import { resolveOAuthIdentity, type OAuthIdentity } from "./accounts";

function wipeOauth() {
  run("DELETE FROM oauth_accounts");
  run("DELETE FROM subscriptions");
  run("DELETE FROM memberships");
  run("DELETE FROM sessions");
  run("DELETE FROM audit_logs");
  run("DELETE FROM organizations WHERE id NOT IN (SELECT tenant_id FROM memberships)");
  run("DELETE FROM users");
}

function makeUser(email: string) {
  const id = newId("usr");
  run(
    "INSERT INTO users (id, email, name, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    id,
    email,
    "Someone",
    "scrypt$16384$0000000000000000$0000000000000000000000000000000000000000000000000000000000000000",
    nowIso(),
    nowIso()
  );
  const orgId = newId("org");
  run(
    "INSERT INTO organizations (id, name, slug, plan, mode, created_at, updated_at) VALUES (?, ?, ?, 'free', 'individual', ?, ?)",
    orgId,
    "Someone's workspace",
    `ws-${id}`,
    nowIso(),
    nowIso()
  );
  run(
    "INSERT INTO memberships (id, tenant_id, user_id, role, created_at) VALUES (?, ?, ?, 'owner', ?)",
    newId("mem"),
    orgId,
    id,
    nowIso()
  );
  return { id, orgId };
}

function google(overrides: Partial<OAuthIdentity> = {}): OAuthIdentity {
  return {
    provider: "google",
    subject: "google-abc-123",
    email: `new-${Date.now()}@example.com`,
    emailVerified: true,
    name: "Aldous",
    ...overrides,
  };
}

describe("resolveOAuthIdentity", () => {
  beforeEach(() => wipeOauth());

  it("registers a brand-new verified identity with owner membership and free plan", async () => {
    const res = (await resolveOAuthIdentity(google({ email: "fresh@example.com" }))) as {
      ok: true;
      userId: string;
      tenantId: string;
    };
    expect(res).toMatchObject({ ok: true, mode: "registered", role: "owner" });
    const user = getDb().prepare("SELECT * FROM users WHERE id = ?").get(res.userId) as
      | { email: string; email_verified_at: string | null; password_hash: string }
      | undefined;
    expect(user).toBeTruthy();
    expect(user!.email).toBe("fresh@example.com");
    expect(user!.email_verified_at).not.toBeNull();
    expect(user!.password_hash).not.toMatch(/decoy/i);
    const org = getDb().prepare("SELECT plan FROM organizations WHERE id = ?").get(res.tenantId) as
      | { plan: string }
      | undefined;
    expect(org!.plan).toBe("free");
    const oa = getDb()
      .prepare("SELECT provider, provider_user_id FROM oauth_accounts WHERE user_id = ?")
      .get(res.userId) as { provider: string; provider_user_id: string } | undefined;
    expect(oa).toMatchObject({ provider: "google", provider_user_id: "google-abc-123" });
  });

  it("logs into an existing link without creating another user", async () => {
    const { id, orgId } = makeUser("existing@example.com");
    run(
      "INSERT INTO oauth_accounts (id, provider, provider_user_id, user_id, created_at, updated_at) VALUES (?, 'google', 'stable-sub', ?, ?, ?)",
      newId("oac"),
      id,
      nowIso(),
      nowIso()
    );
    // The provider email changed: the subject link must still win.
    const res = await resolveOAuthIdentity(
      google({ subject: "stable-sub", email: "different@example.com" })
    );
    expect(res).toMatchObject({ ok: true, mode: "existing", userId: id, tenantId: orgId });
    const count = getDb().prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number };
    expect(count.n).toBe(1);
  });

  it("links a first-time verified email to an existing user owned by that email", async () => {
    const { id } = makeUser("owner@example.com");
    const res = await resolveOAuthIdentity(google({ email: "owner@example.com", subject: "sub-new" }));
    expect(res).toMatchObject({ ok: true, mode: "linked", userId: id });
    const oa = getDb()
      .prepare("SELECT provider_user_id FROM oauth_accounts WHERE user_id = ?")
      .get(id) as { provider_user_id: string } | undefined;
    expect(oa!.provider_user_id).toBe("sub-new");
  });

  it("never links an unverified email and never claims the existing account", async () => {
    const { id } = makeUser("owner@example.com");
    const res = await resolveOAuthIdentity(
      google({ email: "owner@example.com", subject: "sub-x", emailVerified: false })
    );
    // Unverified + email already taken: the only safe outcome is a hard conflict.
    expect(res).toEqual({ ok: false, reason: "email_conflict" });
    // The existing account is untouched: no link row, not even a new session.
    const oaCount = getDb()
      .prepare("SELECT COUNT(*) AS n FROM oauth_accounts")
      .get() as { n: number };
    expect(oaCount.n).toBe(0);
    const owner = getDb().prepare("SELECT email, deleted_at FROM users WHERE id = ?").get(id) as {
      email: string;
      deleted_at: string | null;
    };
    expect(owner.email).toBe("owner@example.com");
    expect(owner.deleted_at).toBeNull();
  });

  it("does not log in through a link whose user was deleted, and does not revive the email", async () => {
    const { id } = makeUser("gone@example.com");
    run("UPDATE users SET deleted_at = ? WHERE id = ?", nowIso(), id);
    run(
      "INSERT INTO oauth_accounts (id, provider, provider_user_id, user_id, created_at, updated_at) VALUES (?, 'google', 'sub-deleted', ?, ?, ?)",
      newId("oac"),
      id,
      nowIso(),
      nowIso()
    );
    const res = await resolveOAuthIdentity(google({ subject: "sub-deleted", email: "gone@example.com" }));
    // Deleted user, email still claimed: hard conflict rather than reviving the
    // old account or inventing a second user with the same address.
    expect(res).toEqual({ ok: false, reason: "email_conflict" });
    const userCount = getDb().prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number };
    expect(userCount.n).toBe(1);
  });
});