import { NextRequest } from "next/server";
import { z } from "zod";
import { row } from "@/lib/db/db";
import { ok, fail, readJson, getClientIp } from "@/lib/http";
import { rateLimit, rateKey } from "@/lib/security/rate-limit";
import { createResetToken, revokeResetTokens } from "@/lib/auth/password-reset";
import { sendEmail, defaultFromEmail } from "@/lib/email/mailer";
import { SITE_URL } from "@/lib/constants";
import { audit } from "@/lib/audit";

const schema = z.object({ email: z.string().email() });

/**
 * Issues a password reset link.
 *
 * Always answers 200 with the same message whether or not the account exists,
 * so this endpoint cannot be used to enumerate registered emails. Sending is
 * best-effort: a mail failure must not turn into a different status code.
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  // Tight limit: this endpoint sends mail, so it is an abuse target.
  const byIp = rateLimit(rateKey("forgot-password", ip), 5, 15 * 60_000);
  if (!byIp.allowed) return fail("Too many requests. Try again later.", 429, "rate_limited");

  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) return ok({ sent: true });

  const email = parsed.data.email.toLowerCase();
  const user = row<{ id: string; name: string }>("SELECT id, name FROM users WHERE email = ?", email);

  if (user) {
    // A per-email cap stops a distributed attacker from mailing a victim
    // repeatedly even while spreading requests across IPs.
    const byEmail = rateLimit(rateKey("forgot-password-email", email), 3, 30 * 60_000);
    if (byEmail.allowed) {
      // Old links stop working the moment a new one is issued.
      revokeResetTokens(user.id);
      const created = createResetToken(user.id);
      if (created) {
        const link = `${SITE_URL}/auth/reset-password?token=${encodeURIComponent(created.token)}`;
        try {
          await sendEmail({
            to: email,
            toName: user.name || undefined,
            fromEmail: defaultFromEmail(),
            subject: "Reset your CreatorOS password",
            html: `<div style="font:15px/1.6 sans-serif;max-width:520px">
        <h2 style="margin:0 0 12px">Reset your password</h2>
        <p>We received a request to reset the password for your CreatorOS account.</p>
        <p><a href="${link}" style="display:inline-block;background:#111;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">Choose a new password</a></p>
        <p style="color:#666;font-size:13px">This link expires in 60 minutes and can be used once.</p>
        <p style="color:#666;font-size:13px">If you did not request this, ignore this email and nothing changes.</p>
      </div>`,
          });
          audit({ userId: user.id, action: "auth.password_reset_requested", meta: { email }, ip });
        } catch (e) {
          // Keep the response identical; record server-side only.
          console.error("[auth] password reset email failed:", e);
        }
      }
    }
  }

  return ok({ sent: true });
}
