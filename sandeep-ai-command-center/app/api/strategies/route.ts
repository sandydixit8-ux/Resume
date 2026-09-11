import { NextRequest, NextResponse } from "next/server";
import { listStrategies, createStrategy, StrategyType } from "@/lib/strategies";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function num(v: unknown, def: number): number {
  const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
  return isNaN(n) ? def : n;
}

export async function GET() {
  try {
    return NextResponse.json({ strategies: await listStrategies() });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name = String(body.name || "").trim();
    const symbol = String(body.symbol || "").trim().toUpperCase();
    const type = String(body.type || "") as StrategyType;

    if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
    if (!symbol) return NextResponse.json({ error: "symbol is required" }, { status: 400 });
    if (!["sma", "rsi"].includes(type)) {
      return NextResponse.json({ error: "type must be sma or rsi" }, { status: 400 });
    }

    const strategy = await createStrategy({
      name,
      symbol,
      exchange: String(body.exchange || "NSE").toUpperCase(),
      interval: String(body.interval || "1D"),
      type,
      fastPeriod: num(body.fastPeriod, 5),
      slowPeriod: num(body.slowPeriod, 20),
      rsiPeriod: num(body.rsiPeriod, 14),
      rsiBuy: num(body.rsiBuy, 30),
      rsiSell: num(body.rsiSell, 70),
      slPct: num(body.slPct, 0),
      tpPct: num(body.tpPct, 0),
      lotSize: num(body.lotSize, 75),
    });

    return NextResponse.json({ strategy }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
