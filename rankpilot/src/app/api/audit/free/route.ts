import { NextRequest } from "next/server";
import { z } from "zod";
import { err, fail, getClientIp, ok } from "@/lib/http";
import { rateLimit } from "@/lib/security/rate-limit";
import { FreeAuditError, runFreeAudit } from "@/lib/audit/free";

const schema = z.object({
  url: z.string().min(1).max(500),
  email: z.string().email().max(200).optional(),
});

const MAX_PER_DAY = 5;

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = rateLimit(`audit:free:${ip}`, MAX_PER_DAY, 24 * 60 * 60_000);
  if (!rl.allowed) {
    return err.rateLimited("Free audit limit reached for today. Try again later or create an account.");
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return err.validation(parsed.error.issues);

  try {
    const result = await runFreeAudit({
      url: parsed.data.url,
      ip,
      email: parsed.data.email ?? null,
    });
    return ok({ audit: result });
  } catch (e) {
    if (e instanceof FreeAuditError) {
      return fail(e.message, 400, e.code);
    }
    return err.server();
  }
}
