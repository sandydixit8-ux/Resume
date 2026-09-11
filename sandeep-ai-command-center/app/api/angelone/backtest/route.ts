import { NextRequest, NextResponse } from "next/server";
import {
  getAuthedContext,
  searchScrip,
  getCandleData,
  AngelError,
} from "@/lib/angelone";
import { runBacktest, BacktestConfig, Strategy } from "@/lib/backtest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_INTERVALS = ["1", "3", "5", "10", "15", "30", "60", "1D", "1W", "1M"];

function num(sp: URLSearchParams, key: string, def: number): number {
  const v = parseFloat(sp.get(key) || "");
  return isNaN(v) ? def : v;
}

async function fetchCandles(
  session: any,
  apiKey: string,
  exchange: string,
  symbol: string,
  interval: string,
  days: number
) {
  const scrips = await searchScrip(session, apiKey, exchange, symbol);
  if (!scrips.length) throw new AngelError(`No scrip found: "${symbol}"`);
  const scrip = scrips[0];
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - days);
  const fromdate = `${from.toISOString().slice(0, 10)} 09:15`;
  const todate = `${now.toISOString().slice(0, 10)} 15:30`;
  return getCandleData(session, apiKey, {
    exchange,
    symboltoken: scrip.symboltoken,
    interval,
    fromdate,
    todate,
  });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const exchange = searchParams.get("exchange")?.trim() || "NSE";
    const symbol = searchParams.get("symbol")?.trim() || "";
    const interval = searchParams.get("interval")?.trim() || "1D";
    const days = Math.min(Math.max(parseInt(searchParams.get("days") || "60", 10), 1), 365);
    const strategy = (searchParams.get("strategy") || "buyhold") as Strategy;
    const signalSymbol = searchParams.get("signalSymbol")?.trim() || "";

    if (!symbol) return NextResponse.json({ error: "symbol is required" }, { status: 400 });
    if (!VALID_INTERVALS.includes(interval)) {
      return NextResponse.json({ error: "invalid interval" }, { status: 400 });
    }
    if (!["buyhold", "sma", "rsi"].includes(strategy)) {
      return NextResponse.json({ error: "invalid strategy" }, { status: 400 });
    }

    const config: BacktestConfig = {
      strategy,
      lots: num(searchParams, "lots", 1),
      lotSize: num(searchParams, "lotSize", 75),
      quantity: num(searchParams, "quantity", 0),
      fastPeriod: num(searchParams, "fastPeriod", 5),
      slowPeriod: num(searchParams, "slowPeriod", 20),
      rsiPeriod: num(searchParams, "rsiPeriod", 14),
      rsiBuy: num(searchParams, "rsiBuy", 30),
      rsiSell: num(searchParams, "rsiSell", 70),
      slPct: num(searchParams, "slPct", 0),
      tpPct: num(searchParams, "tpPct", 0),
      signalSymbol: signalSymbol || undefined,
    };

    const { config: ac, session } = await getAuthedContext();

    const [candles, signalCandles] = await Promise.all([
      fetchCandles(session, ac.apiKey, exchange, symbol, interval, days),
      signalSymbol
        ? fetchCandles(session, ac.apiKey, exchange, signalSymbol, interval, days)
        : Promise.resolve([] as number[][]),
    ]);

    if (!candles || candles.length < 2) {
      return NextResponse.json(
        { error: "Not enough candle data for backtest." },
        { status: 400 }
      );
    }

    const result = runBacktest(symbol, candles, config, signalCandles);
    return NextResponse.json(result);
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