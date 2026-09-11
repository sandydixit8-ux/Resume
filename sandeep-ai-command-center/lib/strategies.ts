import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import { sma, rsi, BacktestConfig } from "@/lib/backtest";

export type StrategyType = "sma" | "rsi";

export type Strategy = {
  id: string;
  name: string;
  symbol: string;
  exchange: string;
  interval: string;
  type: StrategyType;
  fastPeriod: number;
  slowPeriod: number;
  rsiPeriod: number;
  rsiBuy: number;
  rsiSell: number;
  slPct: number;
  tpPct: number;
  lotSize: number;
  createdAt: number;
  updatedAt: number;
};

export type Signal = {
  action: "BUY" | "SELL" | "HOLD";
  price: number;
  reason: string;
  fast?: number | null;
  slow?: number | null;
  rsi?: number | null;
};

const FILE = path.join(process.cwd(), ".angelone", "strategies.json");

async function readAll(): Promise<Strategy[]> {
  try {
    const raw = await fs.readFile(FILE, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Strategy[]) : [];
  } catch {
    return [];
  }
}

async function writeAll(list: Strategy[]): Promise<void> {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(list, null, 2), {
    encoding: "utf-8",
    mode: 0o600,
  });
}

export async function listStrategies(): Promise<Strategy[]> {
  const list = await readAll();
  return list.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getStrategy(id: string): Promise<Strategy | null> {
  const list = await readAll();
  return list.find((s) => s.id === id) || null;
}

export async function createStrategy(input: Omit<Strategy, "id" | "createdAt" | "updatedAt">): Promise<Strategy> {
  const now = Date.now();
  const s: Strategy = { ...input, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
  const list = await readAll();
  list.push(s);
  await writeAll(list);
  return s;
}

export async function updateStrategy(id: string, patch: Partial<Omit<Strategy, "id" | "createdAt">>): Promise<Strategy | null> {
  const list = await readAll();
  const idx = list.findIndex((s) => s.id === id);
  if (idx === -1) return null;
  list[idx] = { ...list[idx], ...patch, id, updatedAt: Date.now() };
  await writeAll(list);
  return list[idx];
}

export async function deleteStrategy(id: string): Promise<boolean> {
  const list = await readAll();
  const next = list.filter((s) => s.id !== id);
  if (next.length === list.length) return false;
  await writeAll(next);
  return true;
}

export function evalSignal(
  strategy: Strategy,
  closes: number[],
  lastClose: number
): Signal {
  if (!closes.length) return { action: "HOLD", price: lastClose, reason: "No data" };

  const cfg: BacktestConfig = {
    strategy: strategy.type,
    lots: 1,
    lotSize: strategy.lotSize,
    quantity: strategy.lotSize,
    fastPeriod: strategy.fastPeriod,
    slowPeriod: strategy.slowPeriod,
    rsiPeriod: strategy.rsiPeriod,
    rsiBuy: strategy.rsiBuy,
    rsiSell: strategy.rsiSell,
    slPct: strategy.slPct,
    tpPct: strategy.tpPct,
  };

  if (strategy.type === "sma") {
    const fast = sma(closes, cfg.fastPeriod);
    const slow = sma(closes, cfg.slowPeriod);
    const i = closes.length - 1;
    const f = fast[i];
    const s = slow[i];
    const fp = i > 0 ? fast[i - 1] : null;
    const sp = i > 0 ? slow[i - 1] : null;
    const price = lastClose;
    if (f === null || s === null || fp === null || sp === null) {
      return { action: "HOLD", price, reason: "Warming up indicators", fast: f, slow: s };
    }
    if (fp <= sp && f > s) {
      return { action: "BUY", price, reason: `Golden cross (${cfg.fastPeriod} SMA > ${cfg.slowPeriod} SMA)`, fast: f, slow: s };
    }
    if (fp >= sp && f < s) {
      return { action: "SELL", price, reason: `Death cross (${cfg.fastPeriod} SMA < ${cfg.slowPeriod} SMA)`, fast: f, slow: s };
    }
    return { action: "HOLD", price, reason: "Trend intact", fast: f, slow: s };
  }

  const r = rsi(closes, cfg.rsiPeriod);
  const i = closes.length - 1;
  const value = r[i];
  const price = lastClose;
  if (value === null) {
    return { action: "HOLD", price, reason: "Warming up RSI" };
  }
  if (value <= cfg.rsiBuy) {
    return { action: "BUY", price, reason: `RSI ${value.toFixed(1)} ≤ ${cfg.rsiBuy} (oversold)`, rsi: value };
  }
  if (value >= cfg.rsiSell) {
    return { action: "SELL", price, reason: `RSI ${value.toFixed(1)} ≥ ${cfg.rsiSell} (overbought)`, rsi: value };
  }
  return { action: "HOLD", price, reason: `RSI ${value.toFixed(1)} in neutral zone`, rsi: value };
}
