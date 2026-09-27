import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/get-session";
import { err } from "@/lib/http";
import { rateLimit, rateKey } from "@/lib/security/rate-limit";
import { exportAccountData } from "@/lib/account/gdpr";

export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();

  const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";
  const rl = rateLimit(rateKey("account-export", ip), 5, 60_000);
  if (!rl.allowed) return err.rateLimited();

  const data = exportAccountData(s.org.id, s.user.id);
  return NextResponse.json(data, {
    headers: { "Content-Disposition": `attachment; filename="account-export-${Date.now()}.json"` },
  });
}