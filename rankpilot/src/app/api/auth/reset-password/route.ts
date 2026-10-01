import { NextRequest } from "next/server";
import { z } from "zod";
import { err, fail, getClientIp, ok } from "@/lib/http";
import { rateLimit } from "@/lib/security/rate-limit";
import { consumeResetToken } from "@/lib/auth/reset";
import { audit } from "@/lib/audit";
import { log } from "@/lib/logger";

const schema = z.object({
  token: z.string().min(1).max(500),
  password: z.string().min(1).max(200),
});

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return err.validation(parsed.error.issues);
  const { token, password } = parsed.data;

  if (!rateLimit(`reset:ip:${ip}`, 10, 15 * 60_000).allowed) return err.rateLimited();

  const result = await consumeResetToken(token, password);

  if (!result.ok) {
    if (result.reason === "weak_password") {
      return fail("Password must be between 8 and 200 characters.", 400, "weak_password");
    }
    // One opaque failure for "unknown", "expired", "used" and "wrong user":
    // distinguishing them would confirm a token was once valid.
    log.warn("auth.reset.rejected", { ip, reason: result.reason });
    return fail("This reset link is invalid or has expired. Request a new one.", 400, "invalid_token");
  }

  audit({ tenantId: null, userId: null, action: "auth.password_reset", ip });
  log.info("auth.reset.ok", { ip });
  return ok({ message: "Your password has been reset. Sign in with your new password." });
}
