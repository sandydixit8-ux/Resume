import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { err, getClientIp, ok } from "@/lib/http";
import { rateLimit } from "@/lib/security/rate-limit";
import { verifyPassword, DECOY_HASH } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/service";
import { setSessionCookie } from "@/lib/auth/session";
import { row } from "@/lib/db/db";
import { audit } from "@/lib/audit";
import { log } from "@/lib/logger";

const schema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return err.validation(parsed.error.issues);
  const { email, password } = parsed.data;

  const rlIp = rateLimit(`login:ip:${ip}`, 10, 15 * 60_000);
  const rlEmail = rateLimit(`login:email:${email}`, 5, 15 * 60_000);
  if (!rlIp.allowed || !rlEmail.allowed) {
    return err.rateLimited("Too many login attempts. Please try again later.");
  }

  const user = row<{ id: string; name: string; password_hash: string; deleted_at: string | null }>(
    "SELECT id, name, password_hash, deleted_at FROM users WHERE email = ?",
    email
  );
  const genericError = NextResponse.json(
    { ok: false, error: { code: "validation", message: "Invalid email or password." } },
    { status: 400 }
  );
  // The password is always verified, against a decoy when the account is
  // unknown, so response time cannot be used to enumerate registered emails.
  const storedHash = user && !user.deleted_at ? user.password_hash : DECOY_HASH;
  const passwordMatches = await verifyPassword(password, storedHash);
  if (!user || user.deleted_at || !passwordMatches) {
    // Logged without the email or password: a failed login is the signal an
    // operator needs, and neither value belongs in a log line.
    log.warn("auth.login.failed", { ip, userId: user?.id ?? null, reason: !user ? "no_such_user" : user.deleted_at ? "deleted" : "bad_password" });
    return genericError;
  }

  const member = row<{ tenant_id: string; role: string }>(
    "SELECT tenant_id, role FROM memberships WHERE user_id = ? ORDER BY created_at LIMIT 1",
    user.id
  );
  if (!member) return genericError;

  const { token } = createSession(
    user.id,
    member.tenant_id,
    ip,
    req.headers.get("user-agent") || ""
  );
  audit({ tenantId: member.tenant_id, userId: user.id, action: "auth.login", ip });
  log.info("auth.login.ok", { ip, userId: user.id, tenantId: member.tenant_id, role: member.role });

  const res = ok({ user: { id: user.id, name: user.name, email }, orgId: member.tenant_id, role: member.role });
  res.headers.set("Set-Cookie", setSessionCookie(token));
  return res;
}
