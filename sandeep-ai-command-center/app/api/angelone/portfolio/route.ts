import { NextResponse } from "next/server";
import {
  getAuthedContext,
  getHoldings,
  getPositions,
  getRMS,
  AngelError,
} from "@/lib/angelone";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { config, session } = await getAuthedContext();
    const [holdings, positions, rms] = await Promise.all([
      getHoldings(session, config.apiKey),
      getPositions(session, config.apiKey),
      getRMS(session, config.apiKey),
    ]);
    return NextResponse.json({ holdings, positions, rms });
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
