export type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

export type Strategy = "buyhold" | "sma" | "rsi";

export type BacktestConfig = {
  strategy: Strategy;
  lots: number;
  lotSize: number;
  quantity: number;
  fastPeriod: number;
  slowPeriod: number;
  rsiPeriod: number;
  rsiBuy: number;
  rsiSell: number;
  slPct: number;
  tpPct: number;
  signalSymbol?: string;
};

export type Trade = {
  entryTime: number;
  exitTime: number;
  entryPrice: number;
  exitPrice: number;
  qty: number;
  pnl: number;
  pnlPct: number;
  holdBars: number;
  reason: string;
};

export type BacktestResult = {
  config: BacktestConfig;
  symbol: string;
  netPnl: number;
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  profitFactor: number;
  maxDrawdown: number;
  avgWin: number;
  avgLoss: number;
  maxWin: number;
  maxLoss: number;
  equityCurve: { time: number; equity: number }[];
  trades: Trade[];
};

function toCandles(raw: number[][]): Candle[] {
  return raw.map((r) => ({
    time: r[0],
    open: r[1],
    high: r[2],
    low: r[3],
    close: r[4],
  }));
}

export function sma(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

export function rsi(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (values.length < period + 1) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = values[i] - values[i - 1];
    if (diff >= 0) gain += diff;
    else loss -= diff;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    const g = diff >= 0 ? diff : 0;
    const l = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

export function runBacktest(
  symbol: string,
  rawCandles: number[][],
  config: BacktestConfig,
  signalRaw?: number[][]
): BacktestResult {
  const candles = toCandles(rawCandles);
  const closes = candles.map((c) => c.close);
  const qty = config.quantity || config.lots * config.lotSize;

  const signalCloses = signalRaw && signalRaw.length ? toCandles(signalRaw).map((c) => c.close) : closes;

  const trades: Trade[] = [];
  const equityCurve: { time: number; equity: number }[] = [];
  let equity = 0;
  let peak = 0;
  let maxDD = 0;
  let totalWin = 0;
  let totalLoss = 0;
  let maxWin = 0;
  let maxLoss = 0;
  let inTrade = false;
  let entryPrice = 0;
  let entryTime = 0;
  let entryBar = 0;

  const sig = config.strategy === "sma" ? sma(signalCloses, config.fastPeriod) : null;
  const sigSlow = config.strategy === "sma" ? sma(signalCloses, config.slowPeriod) : null;
  const rsiArr = config.strategy === "rsi" ? rsi(signalCloses, config.rsiPeriod) : null;

  function crossedAbove(n: number): boolean {
    if (config.strategy !== "sma" || sig === null || sigSlow === null) return false;
    const f = sig[n];
    const s = sigSlow[n];
    const fp = n > 0 ? sig[n - 1] : null;
    const sp = n > 0 ? sigSlow[n - 1] : null;
    if (f === null || s === null || fp === null || sp === null) return false;
    return fp <= sp && f > s;
  }

  function crossedBelow(n: number): boolean {
    if (config.strategy !== "sma" || sig === null || sigSlow === null) return false;
    const f = sig[n];
    const s = sigSlow[n];
    const fp = n > 0 ? sig[n - 1] : null;
    const sp = n > 0 ? sigSlow[n - 1] : null;
    if (f === null || s === null || fp === null || sp === null) return false;
    return fp >= sp && f < s;
  }

  function signalExit(i: number): boolean {
    if (config.strategy === "rsi" && rsiArr) {
      const r = rsiArr[i];
      return r !== null && r >= config.rsiSell;
    }
    if (config.strategy === "sma") return crossedBelow(i);
    return false;
  }

  function signalEntry(i: number): boolean {
    if (config.strategy === "rsi" && rsiArr) {
      const r = rsiArr[i];
      return r !== null && r <= config.rsiBuy;
    }
    if (config.strategy === "sma") return crossedAbove(i);
    return false;
  }

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];

    if (inTrade) {
      // check SL / TP on intra-bar extremes for options (OCO style)
      let closeTrade = false;
      let exitPrice = c.close;
      let reason = "";
      if (config.slPct > 0 && c.low <= entryPrice * (1 - config.slPct / 100)) {
        exitPrice = entryPrice * (1 - config.slPct / 100);
        closeTrade = true;
        reason = "SL";
      } else if (config.tpPct > 0 && c.high >= entryPrice * (1 + config.tpPct / 100)) {
        exitPrice = entryPrice * (1 + config.tpPct / 100);
        closeTrade = true;
        reason = "TP";
      } else if (signalExit(i)) {
        closeTrade = true;
        reason = "Signal";
      }

      if (closeTrade) {
        const pnl = (exitPrice - entryPrice) * qty;
        const pnlPct = ((exitPrice - entryPrice) / entryPrice) * 100;
        trades.push({
          entryTime,
          exitTime: c.time,
          entryPrice,
          exitPrice,
          qty,
          pnl,
          pnlPct,
          holdBars: i - entryBar,
          reason,
        });
        equity += pnl;
        if (pnl >= 0) {
          totalWin += pnl;
          maxWin = Math.max(maxWin, pnl);
        } else {
          totalLoss += -pnl;
          maxLoss = Math.min(maxLoss, pnl);
        }
        inTrade = false;
      }
    } else if (config.strategy !== "buyhold") {
      if (signalEntry(i)) {
        inTrade = true;
        entryPrice = c.close;
        entryTime = c.time;
        entryBar = i;
      }
    }

    if (config.strategy === "buyhold" && i === 0) {
      inTrade = true;
      entryPrice = c.open;
      entryTime = c.time;
      entryBar = i;
    }

    // equity curve uses last close valuation if still in trade
    const mark = inTrade ? c.close : entryPrice;
    const floatEquity = inTrade ? equity + (mark - entryPrice) * qty : equity;
    equityCurve.push({ time: c.time, equity: floatEquity });
    peak = Math.max(peak, floatEquity);
    maxDD = Math.max(maxDD, peak - floatEquity);
  }

  // close open trade at last close
  if (inTrade && candles.length) {
    const last = candles[candles.length - 1];
    const pnl = (last.close - entryPrice) * qty;
    const pnlPct = ((last.close - entryPrice) / entryPrice) * 100;
    trades.push({
      entryTime,
      exitTime: last.time,
      entryPrice,
      exitPrice: last.close,
      qty,
      pnl,
      pnlPct,
      holdBars: candles.length - 1 - entryBar,
      reason: "End of data",
    });
    equity += pnl;
    if (pnl >= 0) {
      totalWin += pnl;
      maxWin = Math.max(maxWin, pnl);
    } else {
      totalLoss += -pnl;
      maxLoss = Math.min(maxLoss, pnl);
    }
  }

  const wins = trades.filter((t) => t.pnl > 0).length;
  const losses = trades.filter((t) => t.pnl <= 0).length;

  return {
    config,
    symbol,
    netPnl: equity,
    totalTrades: trades.length,
    wins,
    losses,
    winRate: trades.length ? (wins / trades.length) * 100 : 0,
    profitFactor: totalLoss > 0 ? totalWin / totalLoss : (totalWin > 0 ? Infinity : 0),
    maxDrawdown: maxDD,
    avgWin: wins ? totalWin / wins : 0,
    avgLoss: losses ? -totalLoss / losses : 0,
    maxWin,
    maxLoss,
    equityCurve,
    trades,
  };
}

export function exportTradesCSV(trades: Trade[], symbol: string): string {
  const esc = (s: unknown) => {
    const str = String(s);
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  const header = ["Entry Time", "Exit Time", "Entry Price", "Exit Price", "Qty", "P&L", "P&L %", "Hold (bars)", "Reason"];
  const lines = trades.map((t) =>
    [
      esc(new Date(t.entryTime).toLocaleString()),
      esc(new Date(t.exitTime).toLocaleString()),
      t.entryPrice,
      t.exitPrice,
      t.qty,
      t.pnl,
      t.pnlPct,
      t.holdBars,
      t.reason,
    ]
      .map(esc)
      .join(",")
  );
  return [header.map(esc).join(","), ...lines].join("\n");
}