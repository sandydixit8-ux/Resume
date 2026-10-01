import { NextRequest } from "next/server";
import { z } from "zod";
import { err, getClientIp, ok } from "@/lib/http";
import { rateLimit } from "@/lib/security/rate-limit";
import { row } from "@/lib/db/db";
import { isEmailConfigured, sendEmail, VERIFICATION_TTL_MINUTES } from "@/lib/email";
import { createVerificationToken, isEmailVerified } from "@/lib/auth/verify-email";
import { audit } from "@/lib/audit";
import { log } from "@/lib/logger";
import { linkBaseUrl } from "@/lib/site-url";

const schema = z.object({ email: z.string().trim().toLowerCase().email() });

/** Always identical, so this cannot be used to test whether an account exists. */
const GENERIC = "If that address needs verifying, a confirmation link is on its way.";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return err.validation(parsed.error.issues);
  const { email } = parsed.data;

  // An unverified address is the abuse case here: without these limits this is
  // a way to mail-bomb somebody who never signed up.
  if (!rateLimit(`resend:ip:${ip}`, 5, 60 * 60_000).allowed) return err.rateLimited();
  if (!rateLimit(`resend:email:${email}`, 3, 60 * 60_000).allowed) {
    return ok({ message: GENERIC });
  }

  if (!isEmailConfigured()) {
    log.error("auth.verify_email.requested", { ip, reason: "email_not_configured" });
    return err.server();
  }

  const user = row<{ id: string; email: string; deleted_at: string | null }>(
    "SELECT id, email, deleted_at FROM users WHERE email = ?",
    email
  );

  if (user && !user.deleted_at && !isEmailVerified(user.id)) {
    const token = createVerificationToken(user.id, ip);
    // Same boundary as the password-reset route: never take the origin from the
    // request, because the Host header is client-controlled and would let an
    // attacker capture the verification token.
    const base = linkBaseUrl();
    if (!base) {
      log.error("auth.verify_email.link_base_unconfigured", {
        ip,
        userId: user.id,
        hint: "set NEXT_PUBLIC_SITE_URL so verification links have a correct origin",
      });
      audit({ tenantId: null, userId: user.id, action: "auth.verification_link_unconfigured", ip });
    } else {
      const result = await sendEmail(
        "email_verification",
        user.email,
        `Confirm your email address to finish setting up RankPilot. This link expires in ${VERIFICATION_TTL_MINUTES} minutes.\n\n${base}/verify-email?token=${token}\n\nIf you did not sign up, ignore this email.`
      );
      if (!result.sent) {
        log.error("auth.verify_email.send_failed", { ip, userId: user.id, ...result });
      }
      audit({ tenantId: null, userId: user.id, action: "auth.verification_requested", ip });
      log.info("auth.verify_email.requested", { ip, userId: user.id, emailSent: result.sent });
    }
  } else {
    log.info("auth.verify_email.requested", { ip, userId: null });
  }

  return ok({ message: GENERIC });
}
