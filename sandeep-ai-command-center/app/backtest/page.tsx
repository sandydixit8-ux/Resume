"use client";

import { useEffect, useRef, useState } from "react";
import { exportTradesCSV, BacktestResult } from "@/lib/backtest";

const section: React.CSSProperties = {
  background: "#111",
  border: "1px solid #222",
  borderRadius: 12,
  padding: "20px",
  margin: "0 0 20px",
};

const h2: React.CSSProperties = { fontSize: 17, margin: "0 0 14px", color: "#eee" };

const label: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: "#999",
  marginBottom: 5,
  textTransform: "uppercase",
  letterSpacing: 0.5,
};

const input: React.CSSProperties = {
  background: "#0a0a0a",
  border: "1px solid #333",
  borderRadius: 8,
  color: "#eee",
  padding: "8px 12px",
  fontSize: 14,
  width: "100%",
  boxSizing: "border-box",
};

const btn: React.CSSProperties = {
  background: "#7aa2f7",
  color: "#0a0a0a",
  border: "none",
  borderRadius: 8,
  padding: "10px 16px",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
};

const card: React.CSSProperties = {
  background: "#0d0d0d",
  border: "1px solid #222",
  borderRadius: 10,
  padding: "14px 16px",
};

const th: React.CSSProperties = {
  textAlign: "left",
  fontSize: 11,
  color: "#888",
  textTransform: "uppercase",
  padding: "6px 10px",
  borderBottom: "1px solid #222",
  whiteSpace: "nowrap",
};

const td: React.CSSProperties = {
  fontSize: 13,
  padding: "8px 10px",
  borderBottom: "1px solid #1a1a1a",
  whiteSpace: "nowrap",
};

function fmt(v: number, digits = 2): string {
  return v.toLocaleString("en-IN", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function inr(v: number): string {
  return "₹" + fmt(v);
}

function StrategyLabel({ label: l }: { label: string }) {
  return <span style={{ fontSize: 13, color: "#ddd" }}>{l}</span>;
}

type NumFieldProps = {
  labelText: string;
  value: number | string;
  onChange: (v: string) => void;
  placeholder?: string;
  small?: boolean;
};

function NumField({ labelText, value, onChange, placeholder, small }: NumFieldProps) {
  return (
    <div style={{ flex: small ? 1 : undefined, minWidth: small ? 110 : "100%" }}>
      <label style={{ ...label, fontSize: 11 }}>{labelText}</label>
      <input
        style={{ ...input, padding: "7px 10px" }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

export default function BacktestPage() {
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [symbol, setSymbol] = useState("");
  const [exchange, setExchange] = useState("NSE");
  const [interval, setInterval] = useState("1D");
  const [days, setDays] = useState("60");
  const [strategy, setStrategy] = useState("buyhold");
  const [signalSymbol, setSignalSymbol] = useState("");
  const [lots, setLots] = useState("1");
  const [lotSize, setLotSize] = useState("75");
  const [quantity, setQuantity] = useState("");
  const [fastP, setFastP] = useState("5");
  const [slowP, setSlowP] = useState("20");
  const [rsiP, setRsiP] = useState("14");
  const [rsiBuy, setRsiBuy] = useState("30");
  const [rsiSell, setRsiSell] = useState("70");
  const [slPct, setSlPct] = useState("");
  const [tpPct, setTpPct] = useState("");

  async function run(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const q = new URLSearchParams({
        symbol: symbol.trim(),
        exchange,
        interval,
        days,
        strategy,
        lots,
        lotSize,
        fastPeriod: fastP,
        slowPeriod: slowP,
        rsiPeriod: rsiP,
        rsiBuy,
        rsiSell,
      });
      if (quantity) q.set("quantity", quantity);
      if (slPct) q.set("slPct", slPct);
      if (tpPct) q.set("tpPct", tpPct);
      if (signalSymbol.trim()) q.set("signalSymbol", signalSymbol.trim());

      const res = await fetch(`/api/angelone/backtest?${q}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Backtest failed");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Backtest failed");
    } finally {
      setLoading(false);
    }
  }

  function downloadCSV() {
    if (!result) return;
    const csv = exportTradesCSV(result.trades, result.symbol);
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `backtest-${result.symbol}-${result.config.strategy}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function openHTMLReport() {
    if (!result) return;
    const r = result;
    const win = window.open("", "_blank");
    if (!win) return;
    const rows = r.trades
      .map(
        (t) => `<tr class="${t.pnl >= 0 ? "win" : "loss"}">
          <td>${new Date(t.entryTime).toLocaleString()}</td>
          <td>${new Date(t.exitTime).toLocaleString()}</td>
          <td>${fmt(t.entryPrice)}</td>
          <td>${fmt(t.exitPrice)}</td>
          <td>${fmt(t.qty, 0)}</td>
          <td>${inr(t.pnl)}</td>
          <td>${fmt(t.pnlPct)}%</td>
          <td>${t.reason}</td>
        </tr>`
      )
      .join("");
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Backtest Report — ${r.symbol}</title>
      <style>
        body{font-family:system-ui,sans-serif;padding:2rem;color:#111;max-width:900px;margin:0 auto}
        h1{margin:0 0 4px}h2{font-size:15px;margin:20px 0 8px}
        .sub{color:#666;margin-bottom:16px}
        .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:8px}
        .card{border:1px solid #ddd;border-radius:8px;padding:10px 12px}
        .card .v{font-size:18px;font-weight:700}
        .card .k{font-size:11px;color:#777;text-transform:uppercase;letter-spacing:.5px}
        .pos{color:#15803d}.neg{color:#b91c1c}
        table{width:100%;border-collapse:collapse;font-size:12px}
        th,td{border-bottom:1px solid #eee;padding:6px;text-align:left;white-space:nowrap}
        th{background:#f5f5f5;font-size:11px;text-transform:uppercase}
        tr.win td:last-child{display:none}
        @media print{body{padding:0}}
      </style></head><body>
      <h1>Backtest Report</h1>
      <div class="sub">${r.symbol} · ${r.config.strategy.toUpperCase()} strategy · ${r.trades.length} trades · generated ${new Date().toLocaleString()}</div>
      <div class="cards">
        <div class="card"><div class="k">Net P&amp;L</div><div class="v ${r.netPnl >= 0 ? "pos" : "neg"}">${inr(r.netPnl)}</div></div>
        <div class="card"><div class="k">Trades</div><div class="v">${r.totalTrades}</div></div>
        <div class="card"><div class="k">Win Rate</div><div class="v">${fmt(r.winRate, 1)}%</div></div>
        <div class="card"><div class="k">Profit Factor</div><div class="v">${r.profitFactor === Infinity ? "∞" : fmt(r.profitFactor)}</div></div>
        <div class="card"><div class="k">Max Drawdown</div><div class="v neg">${inr(r.maxDrawdown)}</div></div>
        <div class="card"><div class="k">Avg Win</div><div class="v pos">${inr(r.avgWin)}</div></div>
        <div class="card"><div class="k">Avg Loss</div><div class="v neg">${inr(r.avgLoss)}</div></div>
        <div class="card"><div class="k">Max Win</div><div class="v pos">${inr(r.maxWin)}</div></div>
        <div class="card"><div class="k">Max Loss</div><div class="v neg">${inr(r.maxLoss)}</div></div>
      </div>
      <h2>Trades</h2>
      <table>
        <thead><tr><th>Entry</th><th>Exit</th><th>Entry Px</th><th>Exit Px</th><th>Qty</th><th>P&amp;L</th><th>P&amp;L %</th><th>Reason</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </body></html>`);
    win.document.close();
  }

  return (
    <main
      style={{
        fontFamily: "system-ui, sans-serif",
        minHeight: "100vh",
        background: "#0a0a0a",
        color: "#eee",
        padding: "2rem 1.5rem 4rem",
      }}
    >
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <a href="/" style={{ color: "#7aa2f7", fontSize: 13, textDecoration: "none" }}>
          &larr; Back to Command Center
        </a>
        <h1 style={{ fontSize: 26, margin: "0.75rem 0 0.25rem" }}>Option Backtest</h1>
        <p style={{ color: "#888", fontSize: 14, margin: "0 0 1.5rem" }}>
          Backtest strategies on option/stock candles and generate a report.
        </p>

        {error && (
          <div
            style={{
              background: "#2a0d0d",
              border: "1px solid #7f1d1d",
              color: "#fca5a5",
              borderRadius: 8,
              padding: "10px 14px",
              fontSize: 13,
              marginBottom: 16,
            }}
          >
            {error}
          </div>
        )}

        <section style={section}>
          <h2 style={h2}>Configuration</h2>
          <form onSubmit={run}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 12,
                marginBottom: 14,
              }}
            >
              <div style={{ gridColumn: "span 2" }}>
                <label style={label}>Symbol (option/stock)</label>
                <input
                  style={input}
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  placeholder="e.g. 26000NIFTY31DEC26CE or RELIANCE"
                  required
                />
              </div>
              <div>
                <label style={label}>Exchange</label>
                <select style={input} value={exchange} onChange={(e) => setExchange(e.target.value)}>
                  <option value="NSE">NSE</option>
                  <option value="NFO">NFO (options)</option>
                  <option value="BSE">BSE</option>
                </select>
              </div>
              <div>
                <label style={label}>Interval</label>
                <select style={input} value={interval} onChange={(e) => setInterval(e.target.value)}>
                  {["1", "3", "5", "10", "15", "30", "60", "1D", "1W", "1M"].map((iv) => (
                    <option key={iv} value={iv}>{iv}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={label}>Days</label>
                <input style={input} type="number" value={days} onChange={(e) => setDays(e.target.value)} />
              </div>
              <div>
                <label style={label}>Strategy</label>
                <select style={input} value={strategy} onChange={(e) => setStrategy(e.target.value)}>
                  <option value="buyhold">Buy &amp; Hold</option>
                  <option value="sma">SMA Crossover</option>
                  <option value="rsi">RSI Reversal</option>
                </select>
              </div>
              <div>
                <label style={label}>Signal Symbol (optional)</label>
                <input
                  style={input}
                  value={signalSymbol}
                  onChange={(e) => setSignalSymbol(e.target.value)}
                  placeholder="e.g. NIFTY if trading options"
                />
              </div>
              <div>
                <label style={label}>Signal Exchange</label>
                <select style={input} value={exchange} onChange={(e) => setExchange(e.target.value)}>
                  <option value="NSE">NSE</option>
                  <option value="NFO">NFO</option>
                </select>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(8, 1fr)",
                gap: 12,
                marginBottom: 14,
              }}
            >
              <NumField small labelText="Lots" value={lots} onChange={setLots} placeholder="1" />
              <NumField small labelText="Lot Size" value={lotSize} onChange={setLotSize} placeholder="75" />
              <NumField small labelText="Qty (overrides lots)" value={quantity} onChange={setQuantity} placeholder="auto" />
              <NumField small labelText="SL %" value={slPct} onChange={setSlPct} placeholder="0 = none" />
              <NumField small labelText="TP %" value={tpPct} onChange={setTpPct} placeholder="0 = none" />
              {strategy === "sma" && (
                <>
                  <NumField small labelText="Fast SMA" value={fastP} onChange={setFastP} />
                  <NumField small labelText="Slow SMA" value={slowP} onChange={setSlowP} />
                </>
              )}
              {strategy === "rsi" && (
                <>
                  <NumField small labelText="RSI Period" value={rsiP} onChange={setRsiP} />
                  <NumField small labelText="Buy &lt;" value={rsiBuy} onChange={setRsiBuy} />
                  <NumField small labelText="Sell &gt;" value={rsiSell} onChange={setRsiSell} />
                </>
              )}
            </div>

            <button style={btn} disabled={loading}>
              {loading ? "Running backtest..." : "Run Backtest"}
            </button>
          </form>
        </section>

        {result && (
          <>
            {/* Stats cards */}
            <section style={section}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h2 style={h2}>Report — <StrategyLabel label={`${result.symbol} · ${result.config.strategy.toUpperCase()}`} /></h2>
                <div style={{ display: "flex", gap: 8 }}>
                  <button style={{ ...btn, background: "#333", color: "#eee" }} onClick={downloadCSV}>
                    Download CSV
                  </button>
                  <button style={btn} onClick={openHTMLReport}>
                    HTML Report
                  </button>
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                  gap: 12,
                }}
              >
                <div style={card}>
                  <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase" }}>Net P&amp;L</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: result.netPnl >= 0 ? "#4ade80" : "#f87171" }}>
                    {inr(result.netPnl)}
                  </div>
                </div>
                <div style={card}>
                  <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase" }}>Trades</div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{result.totalTrades}</div>
                </div>
                <div style={card}>
                  <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase" }}>Win Rate</div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{fmt(result.winRate, 1)}%</div>
                </div>
                <div style={card}>
                  <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase" }}>Profit Factor</div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>
                    {result.profitFactor === Infinity ? "∞" : fmt(result.profitFactor)}
                  </div>
                </div>
                <div style={card}>
                  <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase" }}>Max Drawdown</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "#f87171" }}>{inr(result.maxDrawdown)}</div>
                </div>
                <div style={card}>
                  <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase" }}>Avg Win</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "#4ade80" }}>{inr(result.avgWin)}</div>
                </div>
                <div style={card}>
                  <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase" }}>Avg Loss</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "#f87171" }}>{inr(result.avgLoss)}</div>
                </div>
              </div>

              <EquityCurve data={result.equityCurve} />
            </section>

            {/* Trade list */}
            <section style={section}>
              <h2 style={h2}>Trades ({result.trades.length})</h2>
              <div style={{ overflowX: "auto", maxHeight: 420, overflowY: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%" }}>
                  <thead style={{ position: "sticky", top: 0, background: "#111" }}>
                    <tr>
                      <th style={th}>Entry</th>
                      <th style={th}>Exit</th>
                      <th style={th}>Entry Px</th>
                      <th style={th}>Exit Px</th>
                      <th style={th}>Qty</th>
                      <th style={th}>P&amp;L</th>
                      <th style={th}>P&amp;L %</th>
                      <th style={th}>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.trades.map((t, i) => (
                      <tr key={i}>
                        <td style={td}>{new Date(t.entryTime).toLocaleString()}</td>
                        <td style={td}>{new Date(t.exitTime).toLocaleString()}</td>
                        <td style={td}>{fmt(t.entryPrice)}</td>
                        <td style={td}>{fmt(t.exitPrice)}</td>
                        <td style={td}>{fmt(t.qty, 0)}</td>
                        <td style={{ ...td, color: t.pnl >= 0 ? "#4ade80" : "#f87171", fontWeight: 600 }}>
                          {inr(t.pnl)}
                        </td>
                        <td style={{ ...td, color: t.pnl >= 0 ? "#4ade80" : "#f87171" }}>{fmt(t.pnlPct)}%</td>
                        <td style={td}>{t.reason}</td>
                      </tr>
                    ))}
                    {result.trades.length === 0 && (
                      <tr><td style={{ ...td, color: "#666" }} colSpan={8}>No trades generated by this strategy.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function EquityCurve({ data }: { data: { time: number; equity: number }[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    draw();
  });

  function draw() {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth;
    const H = canvas.clientHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    if (!data.length) return;

    const vals = data.map((p) => p.equity);
    let mn = Math.min(...vals);
    let mx = Math.max(...vals);
    if (mn === mx) { mn -= 1; mx += 1; }
    const pad = (mx - mn) * 0.1;
    mn -= pad; mx += pad;

    const x = (i: number) => (i / (data.length - 1)) * W;
    const y = (v: number) => H - ((v - mn) / (mx - mn)) * H;

    ctx.strokeStyle = "#1c1c1c";
    ctx.lineWidth = 1;
    ctx.font = "10px system-ui";
    ctx.fillStyle = "#555";
    for (let i = 0; i <= 4; i++) {
      const gy = (H / 4) * i;
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
      const val = mx - ((mx - mn) / 4) * i;
      ctx.fillText(inr(val), 4, gy - 3);
    }

    ctx.beginPath();
    data.forEach((p, i) => {
      const xp = x(i);
      const yp = y(p.equity);
      if (i === 0) ctx.moveTo(xp, yp);
      else ctx.lineTo(xp, yp);
    });
    ctx.strokeStyle = "#7aa2f7";
    ctx.lineWidth = 2;
    ctx.stroke();

    if (hover !== null && data[hover]) {
      const p = data[hover];
      const cx = x(hover);
      const cy = y(p.equity);
      ctx.textAlign = "left";
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fillStyle = "#fff";
      ctx.fill();
      ctx.strokeStyle = "#7aa2f7";
      ctx.stroke();
      const boxX = cx + 12 > W - 180 ? cx - 192 : cx + 12;
      const boxY = cy - 40 < 0 ? 4 : cy - 40;
      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(boxX, boxY, 180, 42);
      ctx.strokeStyle = "#333";
      ctx.strokeRect(boxX, boxY, 180, 42);
      ctx.fillStyle = "#ddd";
      ctx.font = "11px system-ui";
      ctx.fillText(new Date(p.time).toLocaleDateString(), boxX + 6, boxY + 16);
      ctx.fillText(inr(p.equity), boxX + 6, boxY + 32);
    }
  }

  function onMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = ref.current;
    if (!canvas || !data.length) return;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const idx = Math.round((px / rect.width) * (data.length - 1));
    setHover(idx >= 0 && idx < data.length ? idx : null);
  }

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 13, color: "#aaa", marginBottom: 8 }}>Equity Curve</div>
      <canvas
        ref={ref}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        style={{ width: "100%", height: 260, display: "block", background: "#0d0d0d", borderRadius: 8, cursor: "crosshair" }}
      />
    </div>
  );
}