import { NextResponse } from "next/server";
import {
  getAuthedContext,
  getGainersLosers,
  getNSEIntraday,
  AngelError,
} from "@/lib/angelone";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { config, session } = await getAuthedContext();
    const [gl, nseMovers] = await Promise.all([
      getGainersLosers(session, config.apiKey, "1d", "NSE"),
      getNSEIntraday(session, config.apiKey),
    ]);
    return NextResponse.json({ ...gl, nseMovers });
  } catch (err) {
    if (err instanceof AngelError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.status && err.status > 0 ? err.status : 400 }
      );
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
