import { NextRequest, NextResponse } from "next/server";
import { getStrategy, evalSignal } from "@/lib/strategies";
import {
  getAuthedContext,
  searchScrip,
  getCandleData,
  AngelError,
} from "@/lib/angelone";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const strategy = await getStrategy(id);
    if (!strategy) return NextResponse.json({ error: "Strategy not found" }, { status: 404 });

    const { config, session } = await getAuthedContext();

    const scrips = await searchScrip(session, config.apiKey, strategy.exchange, strategy.symbol);
    if (!scrips.length) {
      return NextResponse.json({ error: `No scrip found for ${strategy.symbol}` }, { status: 404 });
    }
    const scrip = scrips[0];

    // fetch enough candles to warm up indicators + recent bars
    const bars = 90;
    const now = new Date();
    const from = new Date(now);
    from.setDate(from.getDate() - bars);
    const fromdate = `${from.toISOString().slice(0, 10)} 09:15`;
    const todate = `${now.toISOString().slice(0, 10)} 15:30`;

    const candles = await getCandleData(session, config.apiKey, {
      exchange: strategy.exchange,
      symboltoken: scrip.symboltoken,
      interval: strategy.interval,
      fromdate,
      todate,
    });

    if (!candles.length) {
      return NextResponse.json({ error: "No candle data returned" }, { status: 400 });
    }

    const closes = candles.map((c) => c[4]);
    const lastClose = closes[closes.length - 1];
    const signal = evalSignal(strategy, closes, lastClose);

    return NextResponse.json({
      strategy,
      signal,
      scrip: { tradingsymbol: scrip.tradingsymbol, symboltoken: scrip.symboltoken },
      candles: candles.length,
      evaluatedAt: new Date().toISOString(),
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
