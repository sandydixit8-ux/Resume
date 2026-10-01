import { cookies } from "next/headers";
import { verify, hashToken, COOKIE_NAME } from "./session";
import { row } from "@/lib/db/db";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
}

export interface SessionOrg {
  id: string;
  name: string;
  slug: string;
  plan: string;
  mode: string;
}

export interface SessionResult {
  user: SessionUser;
  org: SessionOrg;
  role: string;
  sid: string;
}

export async function getSession(): Promise<SessionResult | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = verify(token);
  if (!payload?.userId || !payload?.orgId || !payload?.sid) return null;

  const session = row<{ revoked_at: string | null; expires_at: string }>(
    "SELECT revoked_at, expires_at FROM sessions WHERE id = ? AND token_hash = ?",
    payload.sid,
    hashToken(token)
  );
  if (!session || session.revoked_at || session.expires_at <= new Date().toISOString()) {
    return null;
  }

  const member = row<{ role: string }>(
    "SELECT role FROM memberships WHERE user_id = ? AND tenant_id = ?",
    payload.userId,
    payload.orgId
  );
  if (!member) return null;

  const user = row<SessionUser>(
    "SELECT id, email, name FROM users WHERE id = ? AND deleted_at IS NULL",
    payload.userId
  );
  if (!user) return null;

  const org = row<SessionOrg>(
    "SELECT id, name, slug, plan, mode FROM organizations WHERE id = ? AND deleted_at IS NULL",
    payload.orgId
  );
  if (!org) return null;

  return { user, org, role: member.role, sid: payload.sid };
}

export async function requireSession(): Promise<SessionResult> {
  const s = await getSession();
  if (!s) throw new Error("auth_required");
  return s;
}
