import { NextRequest } from "next/server";
import { z } from "zod";
import { err, getClientIp, ok } from "@/lib/http";
import { rateLimit } from "@/lib/security/rate-limit";
import { hashPassword } from "@/lib/auth/password";
import { createSession, uniqueSlug } from "@/lib/auth/service";
import { setSessionCookie } from "@/lib/auth/session";
import { newId, nowIso, row, run } from "@/lib/db/db";
import { audit } from "@/lib/audit";

const schema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(8).max(200),
});

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = rateLimit(`register:${ip}`, 5, 60_000);
  if (!rl.allowed) return err.rateLimited("Too many sign-ups. Try again in a minute.");

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return err.validation(parsed.error.issues);
  const { name, email, password } = parsed.data;

  const existing = row<{ id: string }>("SELECT id FROM users WHERE email = ?", email);
  if (existing) return err.conflict("An account with this email already exists.");

  const userId = newId("usr");
  const orgId = newId("org");
  const now = nowIso();
  run(
    "INSERT INTO users (id, email, name, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    userId,
    email,
    name,
    await hashPassword(password),
    now,
    now
  );
  run(
    "INSERT INTO organizations (id, name, slug, plan, mode, created_at, updated_at) VALUES (?, ?, ?, 'free', 'individual', ?, ?)",
    orgId,
    name ? `${name}'s workspace` : "Workspace",
    uniqueSlug(name || email.split("@")[0]),
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

  const { token } = createSession(userId, orgId, ip, req.headers.get("user-agent") || "");
  audit({ tenantId: orgId, userId, action: "auth.register", entity: "user", entityId: userId, ip });

  const res = ok({ user: { id: userId, name, email }, orgId, role: "owner" });
  res.headers.set("Set-Cookie", setSessionCookie(token));
  return res;
}
