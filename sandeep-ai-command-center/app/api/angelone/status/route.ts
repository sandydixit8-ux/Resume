import { NextRequest, NextResponse } from "next/server";
import {
  getConfig,
  getSession,
  sessionExpired,
  refreshToken,
  getProfile,
  AngelError,
} from "@/lib/angelone";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const config = await getConfig();
    let session = await getSession();
    let profile = null;

    if (session && sessionExpired(session) && session.refreshToken && config) {
      try {
        session = await refreshToken(session);
      } catch {
        session = null;
      }
    }

    if (session && config) {
      try {
        profile = await getProfile(session, config.apiKey);
      } catch (err) {
        if (err instanceof AngelError && err.status === 401) {
          profile = null;
        } else {
          throw err;
        }
      }
    }

    return NextResponse.json({
      configured: Boolean(config),
      apiKeySet: Boolean(config?.apiKey),
      clientId: config?.clientId ?? null,
      connected: Boolean(session && profile),
      profile,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
