import { NextRequest } from "next/server";
import { clearSessionCookie } from "@/lib/auth/session";
import { ok } from "@/lib/http";

export async function POST(_req: NextRequest) {
  return ok({ loggedOut: true }, { headers: { "Set-Cookie": clearSessionCookie() } });
}