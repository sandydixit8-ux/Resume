import { NextRequest, NextResponse } from "next/server";
import {
  getConfig,
  saveConfig,
  loginByPassword,
  clearSession,
  AngelError,
} from "@/lib/angelone";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const apiKey = String(body.apiKey || "").trim();
    const clientId = String(body.clientId || "").trim();
    const pin = String(body.pin || "").trim();
    const totp = String(body.totp || "").trim();

    const existing = await getConfig();
    const resolvedApiKey = apiKey || existing?.apiKey || "";

    if (!resolvedApiKey) throw new AngelError("API key is required.");
    if (!clientId) throw new AngelError("Client ID is required.");
    if (!pin) throw new AngelError("PIN is required.");
    if (!totp) throw new AngelError("TOTP code is required.");

    const session = await loginByPassword({ apiKey: resolvedApiKey, clientId, pin, totp });
    await saveConfig({ apiKey: resolvedApiKey, clientId });

    return NextResponse.json({
      ok: true,
      connected: true,
      clientId: session.clientId,
    });
  } catch (err) {
    if (err instanceof AngelError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status && err.status > 0 ? err.status : 400 }
      );
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
