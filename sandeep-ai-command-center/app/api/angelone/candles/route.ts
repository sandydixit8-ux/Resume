import { NextRequest, NextResponse } from "next/server";
import {
  getAuthedContext,
  searchScrip,
  getCandleData,
  AngelError,
} from "@/lib/angelone";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_INTERVALS = ["1", "3", "5", "10", "15", "30", "60", "1D", "1W", "1M"];

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const symbol = searchParams.get("symbol")?.trim() || "";
    const exchange = searchParams.get("exchange")?.trim() || "NSE";
    const interval = searchParams.get("interval")?.trim() || "1D";
    const days = Math.min(Math.max(parseInt(searchParams.get("days") || "30", 10), 1), 365);

    if (!symbol) {
      return NextResponse.json({ error: "symbol is required" }, { status: 400 });
    }
    if (!VALID_INTERVALS.includes(interval)) {
      return NextResponse.json({ error: "invalid interval" }, { status: 400 });
    }

    const { config, session } = await getAuthedContext();

    const scrips = await searchScrip(session, config.apiKey, exchange, symbol);
    if (!scrips.length) {
      return NextResponse.json({ error: `No scrip found for "${symbol}"` }, { status: 404 });
    }
    const scrip = scrips[0];

    const now = new Date();
    const from = new Date(now);
    from.setDate(from.getDate() - days);
    const fromdate = `${from.toISOString().slice(0, 10)} 09:15`;
    const todate = `${now.toISOString().slice(0, 10)} 15:30`;

    const candles = await getCandleData(session, config.apiKey, {
      exchange,
      symboltoken: scrip.symboltoken,
      interval,
      fromdate,
      todate,
    });

    return NextResponse.json({
      symbol: scrip.tradingsymbol,
      symboltoken: scrip.symboltoken,
      exchange,
      interval,
      candles,
    });
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
