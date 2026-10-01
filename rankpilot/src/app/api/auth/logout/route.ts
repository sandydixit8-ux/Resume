import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { clearSessionCookie, COOKIE_NAME, verify } from "@/lib/auth/session";
import { revokeSession } from "@/lib/auth/service";
import { audit } from "@/lib/audit";

export async function POST(_req: NextRequest) {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (token) {
    const payload = verify(token);
    if (payload?.sid) {
      revokeSession(payload.sid);
      audit({ tenantId: payload.orgId, userId: payload.userId, action: "auth.logout" });
    }
  }
  const res = NextResponse.json({ ok: true, data: { loggedOut: true } });
  res.headers.set("Set-Cookie", clearSessionCookie());
  return res;
}
