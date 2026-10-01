import { NextRequest } from "next/server";
import { z } from "zod";
import { err, fail, getClientIp, ok } from "@/lib/http";
import { rateLimit } from "@/lib/security/rate-limit";
import { consumeVerificationToken } from "@/lib/auth/verify-email";
import { audit } from "@/lib/audit";
import { log } from "@/lib/logger";

const schema = z.object({ token: z.string().min(1).max(500) });

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return err.validation(parsed.error.issues);

  if (!rateLimit(`verify:ip:${ip}`, 20, 15 * 60_000).allowed) return err.rateLimited();

  const result = consumeVerificationToken(parsed.data.token);
  if (!result.ok) {
    log.warn("auth.verify_email.rejected", { ip, reason: result.reason });
    // An invalid or expired link is the same dead end to the user, so say so
    // without distinguishing which, and point at the resend path.
    return fail(
      "This verification link is invalid or has expired.",
      400,
      result.reason === "expired" ? "verify_token_expired" : "invalid_token"
    );
  }

  audit({ tenantId: null, userId: result.userId, action: "auth.email_verified", ip });
  log.info("auth.verify_email.ok", { ip, userId: result.userId });
  return ok({ message: "Email address verified." });
}
