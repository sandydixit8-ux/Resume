import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/get-session";
import { err, getClientIp, ok } from "@/lib/http";
import { rateLimit } from "@/lib/security/rate-limit";
import { run, nowIso } from "@/lib/db/db";
import { clearSessionCookie } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { log } from "@/lib/logger";

/**
 * Sign out everywhere.
 *
 * The case this exists for: a laptop left unlocked, a shared machine, or a
 * password change on another device. Revoking only the current session leaves
 * every other stolen cookie valid, which is the part people forget.
 *
 * The current session is included. "Log me out everywhere" that leaves you
 * logged in here would be surprising, and the caller can always sign in again.
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const s = await getSession();
  if (!s) return err.auth();

  if (!rateLimit(`logout-all:${s.user.id}`, 10, 15 * 60_000).allowed) return err.rateLimited();

  const revoked = run(
    "UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL",
    nowIso(),
    s.user.id
  );

  audit({ tenantId: s.org.id, userId: s.user.id, action: "auth.logout_all", ip });
  log.info("auth.logout_all", { ip, userId: s.user.id, tenantId: s.org.id });

  // This session is among those revoked, so its cookie must go too.
  const res = ok({ message: "Signed out of all sessions.", sessionsRevoked: revoked });
  res.headers.set("Set-Cookie", clearSessionCookie());
  return res;
}
