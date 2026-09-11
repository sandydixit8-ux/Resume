import { NextRequest, NextResponse } from "next/server";
import {
  getAuthedContext,
  searchScrip,
  getQuotes,
  AngelError,
} from "@/lib/angelone";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const symbols: string[] = (body.symbols || []).map((s: string) => s.trim()).filter(Boolean);
    const exchange = String(body.exchange || "NSE");

    if (!symbols.length) {
      return NextResponse.json({ error: "symbols are required" }, { status: 400 });
    }

    const { config, session } = await getAuthedContext();

    const tokens: string[] = [];
    for (const sym of symbols) {
      const scrips = await searchScrip(session, config.apiKey, exchange, sym);
      if (scrips.length) tokens.push(scrips[0].symboltoken);
    }
    if (!tokens.length) {
      return NextResponse.json({ error: "No matching symbols found" }, { status: 404 });
    }

    const quotes = await getQuotes(session, config.apiKey, { [exchange]: tokens });
    return NextResponse.json({ quotes });
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
