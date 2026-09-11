"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const section: React.CSSProperties = {
  background: "#111",
  border: "1px solid #222",
  borderRadius: 12,
  padding: "20px",
  margin: "0 0 20px",
};

const h2: React.CSSProperties = { fontSize: 17, margin: "0 0 14px", color: "#eee" };

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

const input: React.CSSProperties = {
  background: "#0a0a0a",
  border: "1px solid #333",
  borderRadius: 8,
  color: "#eee",
  padding: "8px 12px",
  fontSize: 14,
  marginRight: 8,
};

const btn: React.CSSProperties = {
  background: "#7aa2f7",
  color: "#0a0a0a",
  border: "none",
  borderRadius: 8,
  padding: "8px 14px",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
};

type Row = Record<string, unknown>;

function fmt(v: unknown, digits = 2): string {
  if (typeof v === "number") return v.toLocaleString("en-IN", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  if (typeof v === "string" && !isNaN(Number(v)) && v.trim() !== "") return Number(v).toLocaleString("en-IN", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return v === null || v === undefined ? "—" : String(v);
}

function money(v: unknown): string {
  return "₹" + fmt(v);
}

function str(v: unknown): string {
  return v === null || v === undefined ? "—" : String(v);
}

function pnlStyle(v: unknown): React.CSSProperties {
  const n = Number(v) || 0;
  return { color: n >= 0 ? "#4ade80" : "#f87171", fontWeight: 600 };
}

function changeStyle(v: unknown): React.CSSProperties {
  const n = Number(v) || 0;
  return { color: n >= 0 ? "#4ade80" : "#f87171" };
}

function normalizeTvSymbol(sym: string): string {
  const s = sym.trim().toUpperCase().replace(/\s+/g, "");
  if (s.includes(":")) return s;
  return `NSE:${s}`;
}

export default function AnalysisPage() {
  const [error, setError] = useState("");
  const [portfolio, setPortfolio] = useState<{
    holdings: Row[];
    positions: Row[];
    rms: Row | null;
  } | null>(null);
  const [breadth, setBreadth] = useState<{
    gainers: Row[];
    losers: Row[];
    nseMovers: Row[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const [candles, setCandles] = useState<{
    symbol: string;
    interval: string;
    candles: number[][];
  } | null>(null);
  const [candleSymbol, setCandleSymbol] = useState("RELIANCE");
  const [candleInterval, setCandleInterval] = useState("1D");
  const [candleLoading, setCandleLoading] = useState(false);
  const [candleError, setCandleError] = useState("");

  const [tvSymbol, setTvSymbol] = useState("NSE:RELIANCE");

  const [watchlist, setWatchlist] = useState(["RELIANCE", "TCS", "HDFCBANK", "INFY"]);
  const [quotes, setQuotes] = useState<Row[]>([]);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState("");

  const loadPortfolio = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/angelone/portfolio");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load portfolio");
      setPortfolio(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load portfolio");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadBreadth = useCallback(async () => {
    try {
      const res = await fetch("/api/angelone/breadth");
      const data = await res.json();
      if (res.ok) setBreadth(data);
    } catch {
      /* non-fatal */
    }
  }, []);

  useEffect(() => {
    loadPortfolio();
    loadBreadth();
  }, [loadPortfolio, loadBreadth]);

  async function loadCandles(e?: React.FormEvent) {
    e?.preventDefault();
    setCandleLoading(true);
    setCandleError("");
    try {
      const q = new URLSearchParams({
        symbol: candleSymbol,
        interval: candleInterval,
        days: "60",
      });
      const res = await fetch(`/api/angelone/candles?${q}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load candles");
      setCandles(data);
    } catch (err) {
      setCandleError(err instanceof Error ? err.message : "Failed to load candles");
    } finally {
      setCandleLoading(false);
    }
  }

  async function loadQuotes() {
    setQuoteLoading(true);
    setQuoteError("");
    try {
      const res = await fetch("/api/angelone/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbols: watchlist }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load quotes");
      setQuotes(data.quotes || []);
    } catch (err) {
      setQuoteError(err instanceof Error ? err.message : "Failed to load quotes");
    } finally {
      setQuoteLoading(false);
    }
  }

  useEffect(() => {
    if (!candles && !candleError) loadCandles();
  }, []);

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
        <h1 style={{ fontSize: 26, margin: "0.75rem 0 0.25rem" }}>Market Analysis</h1>
        <p style={{ color: "#888", fontSize: 14, margin: "0 0 1.5rem" }}>
          Portfolio, charts, quotes and market breadth from your Angel One account.
        </p>

        {error && (
          <div style={{ background: "#2a0d0d", border: "1px solid #7f1d1d", color: "#fca5a5", borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

        {/* Portfolio */}
        <section style={section}>
          <h2 style={h2}>Portfolio</h2>
          {loading ? (
            <p style={{ color: "#666" }}>Loading...</p>
          ) : portfolio ? (
            <>
              {portfolio.rms && (
                <div style={{ display: "flex", gap: 24, marginBottom: 14, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontSize: 11, color: "#888" }}>Available Cash</div>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>{money(portfolio.rms.availablecash)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "#888" }}>Utilizable Margin</div>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>{money(portfolio.rms.utilisablemargin)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "#888" }}>Open Positions</div>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>{portfolio.positions.length}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "#888" }}>Holdings</div>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>{portfolio.holdings.length}</div>
                  </div>
                </div>
              )}

              <h3 style={{ fontSize: 14, margin: "16px 0 8px", color: "#aaa" }}>Open Positions</h3>
              <div style={{ overflowX: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%" }}>
                  <thead>
                    <tr>
                      <th style={th}>Symbol</th>
                      <th style={th}>Qty</th>
                      <th style={th}>Avg Price</th>
                      <th style={th}>LTP</th>
                      <th style={th}>P&L</th>
                      <th style={th}>Product</th>
                    </tr>
                  </thead>
                  <tbody>
                    {portfolio.positions.length === 0 && (
                      <tr><td style={{ ...td, color: "#666" }} colSpan={6}>No open positions</td></tr>
                    )}
                    {portfolio.positions.map((p, i) => (
                      <tr key={i}>
                        <td style={td}>{str(p.tradingsymbol)}</td>
                        <td style={td}>{fmt(p.netqty, 0)}</td>
                        <td style={td}>{fmt(p.netavgprice)}</td>
                        <td style={td}>{fmt(p.ltp)}</td>
                        <td style={{ ...td, ...pnlStyle(p.pnl) }}>{money(p.pnl)}</td>
                        <td style={td}>{str(p.producttype)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <h3 style={{ fontSize: 14, margin: "20px 0 8px", color: "#aaa" }}>Holdings</h3>
              <div style={{ overflowX: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%" }}>
                  <thead>
                    <tr>
                      <th style={th}>Symbol</th>
                      <th style={th}>Qty</th>
                      <th style={th}>Avg Price</th>
                      <th style={th}>LTP</th>
                      <th style={th}>Current Value</th>
                      <th style={th}>P&L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {portfolio.holdings.length === 0 && (
                      <tr><td style={{ ...td, color: "#666" }} colSpan={6}>No holdings</td></tr>
                    )}
                    {portfolio.holdings.map((h, i) => (
                      <tr key={i}>
                        <td style={td}>{str(h.tradingSymbol)}</td>
                        <td style={td}>{fmt(h.quantity, 0)}</td>
                        <td style={td}>{fmt(h.averagePrice)}</td>
                        <td style={td}>{fmt(h.ltp)}</td>
                        <td style={td}>{money(h.currentValue)}</td>
                        <td style={{ ...td, ...pnlStyle(h.pnl) }}>{money(h.pnl)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p style={{ color: "#666" }}>Connect your account on /roles to see portfolio data.</p>
          )}
        </section>

        {/* Quotes */}
        <section style={section}>
          <h2 style={h2}>Live Quotes</h2>
          <div style={{ marginBottom: 14 }}>
            <input
              style={{ ...input, flex: 1 }}
              placeholder="Comma separated symbols, e.g. RELIANCE, TCS"
              value={watchlist.join(", ")}
              onChange={(e) => setWatchlist(e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
            />
            <button style={btn} onClick={loadQuotes} disabled={quoteLoading}>
              {quoteLoading ? "Loading..." : "Get Quotes"}
            </button>
          </div>
          {quoteError && <p style={{ color: "#f87171", fontSize: 13 }}>{quoteError}</p>}
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr>
                  <th style={th}>Symbol</th>
                  <th style={th}>LTP</th>
                  <th style={th}>Open</th>
                  <th style={th}>High</th>
                  <th style={th}>Low</th>
                  <th style={th}>Change</th>
                  <th style={th}>%</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((q, i) => (
                  <tr key={i}>
                    <td style={td}>{str(q.tradingsymbol)}</td>
                    <td style={td}>{fmt(q.ltp)}</td>
                    <td style={td}>{fmt(q.open)}</td>
                    <td style={td}>{fmt(q.high)}</td>
                    <td style={td}>{fmt(q.low)}</td>
                    <td style={{ ...td, ...changeStyle(q.netchange) }}>{fmt(q.netchange)}</td>
                    <td style={{ ...td, ...changeStyle(q.percentChange) }}>{fmt(q.percentChange)}%</td>
                  </tr>
                ))}
                {quotes.length === 0 && !quoteError && (
                  <tr><td style={{ ...td, color: "#666" }} colSpan={7}>Enter symbols and click Get Quotes.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Candles */}
        <section style={section}>
          <h2 style={h2}>Candlestick Chart</h2>
          <form onSubmit={loadCandles} style={{ marginBottom: 14 }}>
            <input style={input} value={candleSymbol} onChange={(e) => setCandleSymbol(e.target.value)} placeholder="Symbol (e.g. RELIANCE)" />
            <select
              style={input}
              value={candleInterval}
              onChange={(e) => setCandleInterval(e.target.value)}
            >
              {["1", "3", "5", "10", "15", "30", "60", "1D", "1W", "1M"].map((iv) => (
                <option key={iv} value={iv}>{iv}</option>
              ))}
            </select>
            <button style={btn} disabled={candleLoading}>
              {candleLoading ? "Loading..." : "Chart"}
            </button>
          </form>
          {candleError && <p style={{ color: "#f87171", fontSize: 13 }}>{candleError}</p>}
          {candles && candles.candles.length > 0 && (
            <>
              <div style={{ fontSize: 13, color: "#aaa", marginBottom: 10 }}>
                {candles.symbol} · {candles.interval} · {candles.candles.length} candles
              </div>
              <CandleChart data={candles.candles} />
            </>
          )}
        </section>

        {/* TradingView */}
        <section style={section}>
          <h2 style={h2}>TradingView Chart</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setTvSymbol(normalizeTvSymbol(tvSymbol));
            }}
            style={{ marginBottom: 14 }}
          >
            <input
              style={{ ...input, width: 260 }}
              value={tvSymbol}
              onChange={(e) => setTvSymbol(e.target.value)}
              placeholder="e.g. NSE:RELIANCE or RELIANCE"
            />
            <button style={btn}>Load Chart</button>
            <span style={{ color: "#666", fontSize: 12, marginLeft: 10 }}>
              Free TradingView widget — full indicators &amp; drawing tools.
            </span>
          </form>
          <TradingViewChart symbol={tvSymbol} />
        </section>

        {/* Market breadth */}
        <section style={section}>
          <h2 style={h2}>Market Breadth</h2>
          {breadth ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <h3 style={{ fontSize: 14, margin: "0 0 8px", color: "#4ade80" }}>Top Gainers (NSE)</h3>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ borderCollapse: "collapse", width: "100%" }}>
                    <thead><tr><th style={th}>Symbol</th><th style={th}>Price</th><th style={th}>%</th></tr></thead>
                    <tbody>
                      {(breadth.gainers || []).slice(0, 10).map((g, i) => (
                        <tr key={i}>
                          <td style={td}>{str(g.tradingsymbol)}</td>
                          <td style={td}>{fmt(g.lastprice)}</td>
                          <td style={{ ...td, color: "#4ade80" }}>{fmt(g.percentChange)}%</td>
                        </tr>
                      ))}
                      {(breadth.gainers || []).length === 0 && (
                        <tr><td style={{ ...td, color: "#666" }} colSpan={3}>No data</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              <div>
                <h3 style={{ fontSize: 14, margin: "0 0 8px", color: "#f87171" }}>Top Losers (NSE)</h3>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ borderCollapse: "collapse", width: "100%" }}>
                    <thead><tr><th style={th}>Symbol</th><th style={th}>Price</th><th style={th}>%</th></tr></thead>
                    <tbody>
                      {(breadth.losers || []).slice(0, 10).map((g, i) => (
                        <tr key={i}>
                          <td style={td}>{str(g.tradingsymbol)}</td>
                          <td style={td}>{fmt(g.lastprice)}</td>
                          <td style={{ ...td, color: "#f87171" }}>{fmt(g.percentChange)}%</td>
                        </tr>
                      ))}
                      {(breadth.losers || []).length === 0 && (
                        <tr><td style={{ ...td, color: "#666" }} colSpan={3}>No data</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <p style={{ color: "#666" }}>Market breadth could not be loaded.</p>
          )}
        </section>
      </div>
    </main>
  );
}

function CandleChart({ data }: { data: number[][] }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
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

    const rows = data.map((r) => ({ t: r[0], o: r[1], h: r[2], l: r[3], c: r[4] }));
    if (!rows.length) return;

    const highs = rows.map((r) => r.h);
    const lows = rows.map((r) => r.l);
    let max = Math.max(...highs);
    let min = Math.min(...lows);
    const pad = (max - min) * 0.05 || max * 0.01 || 1;
    max += pad;
    min -= pad;

    const cw = W / rows.length;
    const bodyW = Math.max(cw * 0.6, 2);

    const y = (v: number) => H - ((v - min) / (max - min)) * H;
    const up = "#4ade80";
    const down = "#f87171";

    // grid + price labels
    ctx.font = "10px system-ui";
    ctx.fillStyle = "#555";
    ctx.strokeStyle = "#1c1c1c";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const gy = (H / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(W, gy);
      ctx.stroke();
      const val = max - ((max - min) / 4) * i;
      ctx.fillText(val.toFixed(2), 4, gy - 3);
    }

    rows.forEach((r, i) => {
      const x = i * cw + cw / 2;
      const color = r.c >= r.o ? up : down;
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y(r.h));
      ctx.lineTo(x, y(r.l));
      ctx.stroke();
      const top = Math.min(y(r.o), y(r.c));
      const bh = Math.max(Math.abs(y(r.o) - y(r.c)), 1);
      ctx.fillRect(x - bodyW / 2, top, bodyW, bh);
    });
  }, [data]);

  return (
    <div>
      <canvas ref={ref} style={{ width: "100%", height: 360, display: "block", background: "#0d0d0d", borderRadius: 8 }} />
      <div style={{ display: "flex", gap: 12, fontSize: 11, color: "#888", marginTop: 8 }}>
        <span><span style={{ color: "#4ade80" }}>■</span> Green = close ≥ open</span>
        <span><span style={{ color: "#f87171" }}>■</span> Red = close &lt; open</span>
      </div>
    </div>
  );
}

function TradingViewChart({ symbol }: { symbol: string }) {
  const norm = normalizeTvSymbol(symbol);
  const src =
    "https://s.tradingview.com/widgetembed/" +
    `?symbol=${encodeURIComponent(norm)}` +
    "&interval=D&theme=dark&style=1&locale=en&hide_side_toolbar=0&" +
    "allow_symbol_change=1&saveimage=1&enabled_features=%5B%5D&" +
    "disabled_features=%5B%5D&timezone=Asia%2FKolkata&studies=%5B%5D&" +
    "toolbarbg=f1f3f6&withdateranges=1&details=1&hotlist=1";

  return (
    <div
      style={{
        width: "100%",
        height: 560,
        borderRadius: 8,
        overflow: "hidden",
        border: "1px solid #222",
        background: "#131722",
      }}
    >
      <iframe
        title="TradingView Advanced Chart"
        src={src}
        style={{ width: "100%", height: "100%", border: 0 }}
        allowFullScreen
      />
    </div>
  );
}
