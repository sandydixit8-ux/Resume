import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sandeep AI Command Center",
  description: "Command center web app",
};

export default function Home() {
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "3rem" }}>
      <h1>Sandeep AI Command Center</h1>
      <p>Running at http://127.0.0.1:5000</p>
      <nav style={{ marginTop: "1rem", display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <a
          href="/roles"
          style={{
            color: "#7aa2f7",
            textDecoration: "none",
            border: "1px solid #333",
            borderRadius: 8,
            padding: "8px 14px",
            display: "inline-block",
          }}
        >
          Role Setup — Connect Angel One
        </a>
        <a
          href="/analysis"
          style={{
            color: "#7aa2f7",
            textDecoration: "none",
            border: "1px solid #333",
            borderRadius: 8,
            padding: "8px 14px",
            display: "inline-block",
          }}
        >
          Market Analysis
        </a>
        <a
          href="/backtest"
          style={{
            color: "#7aa2f7",
            textDecoration: "none",
            border: "1px solid #333",
            borderRadius: 8,
            padding: "8px 14px",
            display: "inline-block",
          }}
        >
          Option Backtest & Reports
        </a>
        <a
          href="/strategies"
          style={{
            color: "#7aa2f7",
            textDecoration: "none",
            border: "1px solid #333",
            borderRadius: 8,
            padding: "8px 14px",
            display: "inline-block",
          }}
        >
          Trading Strategies
        </a>
      </nav>
    </main>
  );
}
