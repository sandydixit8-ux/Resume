/**
 * OAuth account resolution.
 *
 * When a provider hands back a verified profile we must map it to an internal
 * user. Order of operations matters for both correctness and security:
 *
 *   1. Look up the provider+subject link first — the subject is the only
 *      provider string that is stable for one human. If found, that user logs
 *      in; the accompanying email is never used to redirect a login to a
 *      different account (a provider subject is not the email, and a provider
 *      that recycles a subject must not fold two humans together).
 *
 *   2. Otherwise, match on the email — only because the providers we ship
 *      verify the address (Google's `email_verified`). An unverified provider
 *      email is never used for linking.
 *
 *   3. Otherwise create a fresh user + personal workspace, mirroring the
 *      password-registration flow so the post-registration layout (owner
 *      membership, free subscription) is identical however someone arrived.
 *
 * A Google-created account has no password the user knows, but `users`
 * requires a non-null hash. We store an unguessable random hash (a real scrypt
 * value, not the shared decoy) so password-based login always fails while the
 * stored value still parses as a genuine hash — keeping verify timing identical
 * to a password account so response time cannot reveal that an account is
 * OAuth-only. Password reset works normally afterwards.
 *
 * This module resolves and persists; the routes create the session and set the
 * cookie, exactly like `login` and `register`.
 */

import { randomBytes } from "node:crypto";
import { hashPassword } from "../password";
import { uniqueSlug } from "../service";
import { newId, nowIso, row, run } from "@/lib/db/db";

export type OAuthProviderName = "google";

/** A verified identity from a provider, already approved for linking. */
export interface OAuthIdentity {
  provider: OAuthProviderName;
  subject: string;
  email: string;
  emailVerified: boolean;
  name: string;
}

export type OAuthResolution =
  | { ok: true; mode: "existing" | "linked" | "registered"; userId: string; tenantId: string; role: string }
  | { ok: false; reason: "no_membership" | "email_conflict" };

/**
 * Map a verified provider identity to an internal user + workspace. Returns a
 * value the routes branch on; no session is created here.
 */
export async function resolveOAuthIdentity(
  identity: OAuthIdentity
): Promise<OAuthResolution> {
  const { provider } = identity;
  const now = nowIso();

  // 1. Existing link wins. A changed provider email must not move the login.
  const link = row<{ user_id: string }>(
    "SELECT user_id FROM oauth_accounts WHERE provider = ? AND provider_user_id = ?",
    provider,
    identity.subject
  );
  if (link) {
    const user = row<{ id: string; deleted_at: string | null }>(
      "SELECT id, deleted_at FROM users WHERE id = ?",
      link.user_id
    );
    if (user && !user.deleted_at) {
      const member = firstMembership(user.id);
      if (member) return { ok: true, mode: "existing", userId: user.id, ...member };
    }
    // Deleted user (or no usable membership) must not log in through a stale
    // link; fall through so the flow cannot be weaponised by a recycled subject.
  }

  // 2. Verified-email match links a first-time provider sign-in to an existing
  //    account. This is exactly why `emailVerified` must be true here and why
  //    providers that do not verify cannot use this path.
  if (identity.emailVerified) {
    const existing = row<{ id: string; deleted_at: string | null }>(
      "SELECT id, deleted_at FROM users WHERE email = ?",
      identity.email
    );
    if (existing && !existing.deleted_at) {
      const member = firstMembership(existing.id);
      if (member) {
        run(
          "INSERT INTO oauth_accounts (id, provider, provider_user_id, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
          newId("oac"),
          provider,
          identity.subject,
          existing.id,
          now,
          now
        );
        return { ok: true, mode: "linked", userId: existing.id, ...member };
      }
    }
  }

  // 3. Fresh account: same rows as password registration plus the provider
  //    link. The provider verified the email, so mark it verified from birth
  //    instead of forcing another confirmation click.
  //
  //    If a user with this email already exists (even deleted — the email stays
  //    claimed until purged) we cannot take it, and we must not silently attach
  //    the new provider subject to the old row. Fail closed; the operator sees
  //    a distinct outcome instead of a UNIQUE constraint crash.
  const taken = row("SELECT id FROM users WHERE email = ?", identity.email);
  if (taken) return { ok: false, reason: "email_conflict" };

  const userId = newId("usr");
  const orgId = newId("org");
  const name = identity.name || identity.email.split("@")[0];
  run(
    "INSERT INTO users (id, email, name, password_hash, email_verified_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    userId,
    identity.email,
    name,
    await randomPasswordHash(),
    now,
    now,
    now
  );
  run(
    "INSERT INTO organizations (id, name, slug, plan, mode, created_at, updated_at) VALUES (?, ?, ?, 'free', 'individual', ?, ?)",
    orgId,
    name ? `${name}'s workspace` : "Workspace",
    uniqueSlug(name || identity.email.split("@")[0]),
    now,
    now
  );
  run(
    "INSERT INTO memberships (id, tenant_id, user_id, role, created_at) VALUES (?, ?, ?, 'owner', ?)",
    newId("mem"),
    orgId,
    userId,
    now
  );
  run(
    "INSERT INTO subscriptions (id, tenant_id, plan, status, created_at, updated_at) VALUES (?, ?, 'free', 'active', ?, ?)",
    newId("sub"),
    orgId,
    now,
    now
  );
  run(
    "INSERT INTO oauth_accounts (id, provider, provider_user_id, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    newId("oac"),
    provider,
    identity.subject,
    userId,
    now,
    now
  );
  return { ok: true, mode: "registered", userId, tenantId: orgId, role: "owner" };
}

/** First membership with a non-deleted organization, oldest first. */
function firstMembership(userId: string): { tenantId: string; role: string } | null {
  const row_ = row<{ tenant_id: string; role: string }>(
    `SELECT m.tenant_id, m.role
     FROM memberships m
     JOIN organizations o ON o.id = m.tenant_id
     WHERE m.user_id = ? AND o.deleted_at IS NULL
     ORDER BY m.created_at LIMIT 1`,
    userId
  );
  if (!row_) return null;
  return { tenantId: row_.tenant_id, role: row_.role };
}

async function randomPasswordHash(): Promise<string> {
  return hashPassword(randomBytes(32).toString("base64url"));
}