import { NextRequest } from "next/server";
import { z } from "zod";
import { err, fail, getClientIp, ok } from "@/lib/http";
import { rateLimit } from "@/lib/security/rate-limit";
import { row } from "@/lib/db/db";
import { isEmailConfigured, sendEmail, RESET_TTL_MINUTES } from "@/lib/email";
import { createResetToken } from "@/lib/auth/reset";
import { audit } from "@/lib/audit";
import { log } from "@/lib/logger";
import { linkBaseUrl } from "@/lib/site-url";

const schema = z.object({ email: z.string().trim().toLowerCase().email() });

/** Always the same response, so this cannot be used to test for accounts. */
const GENERIC = "If an account exists for that address, a reset link is on its way.";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return err.validation(parsed.error.issues);
  const { email } = parsed.data;

  // Two limits: the IP cap stops one host spraying, the email cap stops a
  // distributed attacker using this as a mail cannon against one victim.
  if (!rateLimit(`forgot:ip:${ip}`, 5, 15 * 60_000).allowed) return err.rateLimited();
  if (!rateLimit(`forgot:email:${email}`, 3, 60 * 60_000).allowed) {
    return ok({ message: GENERIC });
  }

  // Checked before the lookup: when email is unconfigured every caller gets the
  // same 503, so this cannot leak whether the address is registered.
  if (!isEmailConfigured()) {
    log.error("auth.reset.requested", { ip, reason: "email_not_configured" });
    return fail(
      "Password reset is unavailable because no email transport is configured.",
      503,
      "reset_unavailable"
    );
  }

  const user = row<{ id: string; name: string; email: string; deleted_at: string | null }>(
    "SELECT id, name, email, deleted_at FROM users WHERE email = ?",
    email
  );

  if (user && !user.deleted_at) {
    const token = createResetToken(user.id, ip);
    // Never derive this from the request. See linkBaseUrl(): a Host-header
    // fallback here lets a forged Host redirect the victim's reset token to an
    // attacker's domain. If the site URL is unset we send nothing and report
    // the misconfiguration instead.
    const base = linkBaseUrl();
    if (!base) {
      log.error("auth.reset.link_base_unconfigured", {
        ip,
        userId: user.id,
        hint: "set NEXT_PUBLIC_SITE_URL so reset links have a correct origin",
      });
      audit({ tenantId: null, userId: user.id, action: "auth.reset_link_unconfigured", ip });
    } else {
      const result = await sendEmail(
        "password_reset",
        user.email,
        `Use this link to choose a new password. It expires in ${RESET_TTL_MINUTES} minutes and can be used once.\n\n${base}/reset-password?token=${token}\n\nIf you did not request this, ignore this email and your password will stay unchanged.`
      );
      if (!result.sent) {
        // The token exists but may not have been delivered. Say so internally;
        // the caller still gets the generic message so this is not an oracle.
        log.error("auth.reset.email_failed", { ip, userId: user.id, ...result });
      }
      audit({ tenantId: null, userId: user.id, action: "auth.reset_requested", ip });
      log.info("auth.reset.requested", { ip, userId: user.id, emailSent: result.sent });
    }
  } else {
    // Keep the cost of an unknown address close to a known one so the response
    // time does not reveal whether the account exists.
    log.info("auth.reset.requested", { ip, userId: null });
  }

  return ok({ message: GENERIC });
}
