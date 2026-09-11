import { NextRequest, NextResponse } from "next/server";
import { updateStrategy, deleteStrategy, StrategyType } from "@/lib/strategies";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function num(v: unknown, def: number): number {
  const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
  return isNaN(n) ? def : n;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const patch: Record<string, unknown> = {};

    if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim();
    if (typeof body.symbol === "string" && body.symbol.trim()) patch.symbol = body.symbol.trim().toUpperCase();
    if (typeof body.exchange === "string" && body.exchange.trim()) patch.exchange = body.exchange.trim().toUpperCase();
    if (typeof body.interval === "string" && body.interval.trim()) patch.interval = body.interval.trim();
    if (body.type === "sma" || body.type === "rsi") patch.type = body.type as StrategyType;
    for (const key of ["fastPeriod", "slowPeriod", "rsiPeriod", "rsiBuy", "rsiSell", "slPct", "tpPct", "lotSize"] as const) {
      if (body[key] !== undefined) patch[key] = num(body[key], 0);
    }

    const updated = await updateStrategy(id, patch);
    if (!updated) return NextResponse.json({ error: "Strategy not found" }, { status: 404 });
    return NextResponse.json({ strategy: updated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ok = await deleteStrategy(id);
    if (!ok) return NextResponse.json({ error: "Strategy not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
