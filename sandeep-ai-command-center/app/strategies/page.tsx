"use client";

import { useCallback, useEffect, useState } from "react";

type Strategy = {
  id: string;
  name: string;
  symbol: string;
  exchange: string;
  interval: string;
  type: "sma" | "rsi";
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

type Signal = {
  action: "BUY" | "SELL" | "HOLD";
  price: number;
  reason: string;
  fast?: number | null;
  slow?: number | null;
  rsi?: number | null;
};

type SignalResult = {
  signal: Signal;
  scrip: { tradingsymbol: string; symboltoken: string };
  candles: number;
  evaluatedAt: string;
};

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

const smallBtn: React.CSSProperties = {
  background: "transparent",
  border: "1px solid #333",
  color: "#ddd",
  borderRadius: 8,
  padding: "6px 12px",
  fontSize: 12,
  cursor: "pointer",
};

const actionColors: Record<Signal["action"], string> = {
  BUY: "#4ade80",
  SELL: "#f87171",
  HOLD: "#facc15",
};

export default function StrategiesPage() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [signals, setSignals] = useState<Record<string, SignalResult>>({});
  const [signaling, setSignaling] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [exchange, setExchange] = useState("NSE");
  const [interval, setInterval] = useState("1D");
  const [type, setType] = useState<"sma" | "rsi">("sma");
  const [fastP, setFastP] = useState("5");
  const [slowP, setSlowP] = useState("20");
  const [rsiP, setRsiP] = useState("14");
  const [rsiBuy, setRsiBuy] = useState("30");
  const [rsiSell, setRsiSell] = useState("70");
  const [slPct, setSlPct] = useState("");
  const [tpPct, setTpPct] = useState("");
  const [lotSize, setLotSize] = useState("75");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/strategies");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load strategies");
      setStrategies(data.strategies || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load strategies");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/strategies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          symbol,
          exchange,
          interval,
          type,
          fastPeriod: fastP,
          slowPeriod: slowP,
          rsiPeriod: rsiP,
          rsiBuy,
          rsiSell,
          slPct: slPct || 0,
          tpPct: tpPct || 0,
          lotSize: lotSize || 75,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create strategy");
      setName(""); setSymbol(""); setSlPct(""); setTpPct("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create strategy");
    } finally {
      setSaving(false);
    }
  }

  async function runSignal(id: string) {
    setSignaling((s) => ({ ...s, [id]: true }));
    setError("");
    try {
      const res = await fetch(`/api/strategies/${id}/signal`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to run signal");
      setSignals((s) => ({ ...s, [id]: data }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run signal");
    } finally {
      setSignaling((s) => ({ ...s, [id]: false }));
    }
  }

  async function remove(id: string) {
    try {
      const res = await fetch(`/api/strategies/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
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
        <h1 style={{ fontSize: 26, margin: "0.75rem 0 0.25rem" }}>Trading Strategies</h1>
        <p style={{ color: "#888", fontSize: 14, margin: "0 0 1.5rem" }}>
          Save reusable strategies and run live signals against current prices.
        </p>

        {error && (
          <div style={{ background: "#2a0d0d", border: "1px solid #7f1d1d", color: "#fca5a5", borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

        {/* Create form */}
        <section style={section}>
          <h2 style={h2}>New Strategy</h2>
          <form onSubmit={create}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 14 }}>
              <div>
                <label style={label}>Name</label>
                <input style={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. NIFTY RSI Dip" required />
              </div>
              <div>
                <label style={label}>Symbol</label>
                <input style={input} value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder="e.g. NIFTY" required />
              </div>
              <div>
                <label style={label}>Exchange</label>
                <select style={input} value={exchange} onChange={(e) => setExchange(e.target.value)}>
                  <option value="NSE">NSE</option>
                  <option value="NFO">NFO</option>
                  <option value="BSE">BSE</option>
                </select>
              </div>
              <div>
                <label style={label}>Interval</label>
                <select style={input} value={interval} onChange={(e) => setInterval(e.target.value)}>
                  {["5", "15", "30", "60", "1D", "1W"].map((iv) => (
                    <option key={iv} value={iv}>{iv}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={label}>Type</label>
                <select style={input} value={type} onChange={(e) => setType(e.target.value as "sma" | "rsi")}>
                  <option value="sma">SMA Crossover</option>
                  <option value="rsi">RSI Reversal</option>
                </select>
              </div>
              {type === "sma" ? (
                <>
                  <div><label style={label}>Fast SMA</label><input style={input} type="number" value={fastP} onChange={(e) => setFastP(e.target.value)} /></div>
                  <div><label style={label}>Slow SMA</label><input style={input} type="number" value={slowP} onChange={(e) => setSlowP(e.target.value)} /></div>
                </>
              ) : (
                <>
                  <div><label style={label}>RSI Period</label><input style={input} type="number" value={rsiP} onChange={(e) => setRsiP(e.target.value)} /></div>
                  <div><label style={label}>Buy &lt;=</label><input style={input} type="number" value={rsiBuy} onChange={(e) => setRsiBuy(e.target.value)} /></div>
                  <div><label style={label}>Sell &gt;=</label><input style={input} type="number" value={rsiSell} onChange={(e) => setRsiSell(e.target.value)} /></div>
                </>
              )}
              <div><label style={label}>SL %</label><input style={input} type="number" value={slPct} onChange={(e) => setSlPct(e.target.value)} placeholder="0" /></div>
              <div><label style={label}>TP %</label><input style={input} type="number" value={tpPct} onChange={(e) => setTpPct(e.target.value)} placeholder="0" /></div>
              <div><label style={label}>Lot Size</label><input style={input} type="number" value={lotSize} onChange={(e) => setLotSize(e.target.value)} /></div>
            </div>
            <button style={btn} disabled={saving}>
              {saving ? "Saving..." : "Save Strategy"}
            </button>
          </form>
        </section>

        {/* Strategy list */}
        <section style={section}>
          <h2 style={h2}>Saved Strategies ({strategies.length})</h2>
          {strategies.length === 0 && <p style={{ color: "#666", fontSize: 14 }}>No strategies yet. Create one above.</p>}

          {strategies.map((s) => {
            const sig = signals[s.id];
            return (
              <div
                key={s.id}
                style={{
                  background: "#0d0d0d",
                  border: "1px solid #222",
                  borderRadius: 10,
                  padding: "14px 16px",
                  marginBottom: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{s.name}</div>
                  <span style={{ fontSize: 12, color: "#888" }}>
                    {s.symbol} · {s.exchange} · {s.interval}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      background: s.type === "sma" ? "#1d2f4d" : "#4d1d1d",
                      color: s.type === "sma" ? "#7aa2f7" : "#f87171",
                      borderRadius: 6,
                      padding: "2px 8px",
                    }}
                  >
                    {s.type.toUpperCase()}
                  </span>
                  {sig && (
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 800,
                        color: actionColors[sig.signal.action],
                        background: "#111",
                        border: `1px solid ${actionColors[sig.signal.action]}44`,
                        borderRadius: 8,
                        padding: "4px 12px",
                      }}
                    >
                      {sig.signal.action}
                    </span>
                  )}
                  <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                    <button style={{ ...smallBtn, background: "#14532d33", borderColor: "#14532d", color: "#4ade80" }} disabled={signaling[s.id]} onClick={() => runSignal(s.id)}>
                      {signaling[s.id] ? "Running..." : "Run Signal"}
                    </button>
                    <button style={{ ...smallBtn, color: "#f87171", borderColor: "#7f1d1d" }} onClick={() => remove(s.id)}>
                      Delete
                    </button>
                  </div>
                </div>

                {sig && (
                  <div style={{ marginTop: 12, borderTop: "1px solid #222", paddingTop: 10, fontSize: 13 }}>
                    <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                      <span>Price: <b>{sig.signal.price.toLocaleString("en-IN")}</b></span>
                      {sig.signal.fast !== undefined && <span>Fast SMA: <b>{sig.signal.fast?.toFixed(2) ?? "—"}</b></span>}
                      {sig.signal.slow !== undefined && <span>Slow SMA: <b>{sig.signal.slow?.toFixed(2) ?? "—"}</b></span>}
                      {sig.signal.rsi !== undefined && <span>RSI: <b>{sig.signal.rsi?.toFixed(1) ?? "—"}</b></span>}
                      <span>Candles: {sig.candles}</span>
                      <span style={{ color: "#666" }}>at {new Date(sig.evaluatedAt).toLocaleString()}</span>
                    </div>
                    <div style={{ color: "#aaa", marginTop: 6 }}>{sig.signal.reason}</div>
                  </div>
                )}
              </div>
            );
          })}
        </section>
      </div>
    </main>
  );
}
