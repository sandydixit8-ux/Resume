import { cookies } from "next/headers";
import { verify } from "./session";
import { all, row } from "@/lib/db/db";

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
}

export interface SessionResult {
  user: SessionUser;
  org: SessionOrg;
  role: string;
}

export async function getSession(): Promise<SessionResult | null> {
  const store = await cookies();
  const token = store.get("creatoros_session")?.value;
  if (!token) return null;
  const payload = verify(token);
  if (!payload?.userId || !payload?.orgId) return null;

  const member = row<{ role: string }>(
    "SELECT role FROM memberships WHERE user_id = ? AND tenant_id = ?",
    payload.userId,
    payload.orgId
  );
  if (!member) return null;

  const user = row<SessionUser>(
    "SELECT id, email, name FROM users WHERE id = ?",
    payload.userId
  );
  if (!user) return null;

  const org = row<SessionOrg>(
    "SELECT id, name, slug, plan FROM organizations WHERE id = ?",
    payload.orgId
  );
  if (!org) return null;

  return { user, org, role: member.role };
}

export async function requireSession(): Promise<SessionResult> {
  const s = await getSession();
  if (!s) throw new Error("auth_required");
  return s;
}