import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { clearSessionCookie } from "@/lib/auth/session";
import { ok, err, readJson } from "@/lib/http";
import { rateLimit, rateKey } from "@/lib/security/rate-limit";
import { audit } from "@/lib/audit";
import { deleteAccountData } from "@/lib/account/gdpr";

const deleteSchema = z.object({ confirm: z.literal("DELETE") });

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();

  const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";
  const rl = rateLimit(rateKey("account-delete", ip), 3, 60_000);
  if (!rl.allowed) return err.rateLimited();

  const body = await readJson(req);
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) return err.validation({ confirm: "Type DELETE to confirm" });

  audit({ tenantId: s.org.id, userId: s.user.id, action: "account.delete", ip });
  deleteAccountData(s.org.id, s.user.id);

  return ok({ deleted: true }, { headers: { "Set-Cookie": clearSessionCookie() } });
}