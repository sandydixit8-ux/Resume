"use client";

import { useCallback, useEffect, useState } from "react";

type Profile = {
  clientcode?: string;
  name?: string;
  email?: string;
  mobileno?: string;
  [k: string]: unknown;
};

type Status = {
  configured: boolean;
  apiKeySet: boolean;
  clientId: string | null;
  connected: boolean;
  profile: Profile | null;
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #333",
  background: "#111",
  color: "#eee",
  fontSize: 14,
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: "#999",
  marginBottom: 6,
  textTransform: "uppercase",
  letterSpacing: 0.5,
};

const fieldStyle: React.CSSProperties = { marginBottom: 16 };

export default function RolesPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [apiKey, setApiKey] = useState("");
  const [clientId, setClientId] = useState("");
  const [pin, setPin] = useState("");
  const [totp, setTotp] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/angelone/status");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load status");
      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load status");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/angelone/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, clientId, pin, totp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.code || "Login failed");
      setApiKey("");
      setPin("");
      setTotp("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleDisconnect() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/angelone/logout", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Logout failed");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Logout failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      style={{
        fontFamily: "system-ui, sans-serif",
        minHeight: "100vh",
        background: "#0a0a0a",
        color: "#eee",
        padding: "3rem 1.5rem",
      }}
    >
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <a
          href="/"
          style={{ color: "#7aa2f7", fontSize: 13, textDecoration: "none" }}
        >
          &larr; Back to Command Center
        </a>

        <h1 style={{ fontSize: 26, margin: "1rem 0 0.25rem" }}>Role Setup</h1>
        <p style={{ color: "#888", fontSize: 14, marginTop: 0 }}>
          Connect your Angel One trading account via Smart API.
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
              margin: "1rem 0",
            }}
          >
            {error}
          </div>
        )}

        {loading ? (
          <p style={{ color: "#666", fontSize: 14 }}>Checking connection...</p>
        ) : (
          <>
            <div
              style={{
                display: "flex",
                gap: 12,
                alignItems: "center",
                background: "#111",
                border: `1px solid ${status?.connected ? "#14532d" : "#333"}`,
                borderRadius: 12,
                padding: "16px 18px",
                margin: "1.5rem 0",
              }}
            >
              <span
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  background: status?.connected ? "#22c55e" : "#555",
                  flexShrink: 0,
                }}
              />
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>
                  {status?.connected ? "Connected" : "Not connected"}
                </div>
                {status?.connected && status.profile ? (
                  <div style={{ color: "#999", fontSize: 13 }}>
                    {status.profile.name} · {status.profile.clientcode}
                    {status.profile.email ? ` · ${status.profile.email}` : ""}
                  </div>
                ) : (
                  <div style={{ color: "#777", fontSize: 13 }}>
                    {status?.apiKeySet
                      ? "API key saved. Enter Client ID, PIN and TOTP to connect."
                      : "Add your Smart API key and login credentials."}
                  </div>
                )}
              </div>
              {status?.connected && (
                <button
                  onClick={handleDisconnect}
                  disabled={busy}
                  style={{
                    marginLeft: "auto",
                    background: "transparent",
                    border: "1px solid #7f1d1d",
                    color: "#fca5a5",
                    borderRadius: 8,
                    padding: "8px 14px",
                    cursor: "pointer",
                    fontSize: 13,
                  }}
                >
                  {busy ? "..." : "Disconnect"}
                </button>
              )}
            </div>

            {!status?.connected && (
              <form
                onSubmit={handleConnect}
                style={{
                  background: "#111",
                  border: "1px solid #222",
                  borderRadius: 12,
                  padding: "20px",
                }}
              >
                {!status?.apiKeySet && (
                  <div style={fieldStyle}>
                    <label style={labelStyle}>Smart API Key</label>
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="API key from smartapi.angelone.in"
                      style={inputStyle}
                      required
                      autoComplete="off"
                    />
                    <div style={{ color: "#666", fontSize: 12, marginTop: 6 }}>
                      Create an app at{" "}
                      <a
                        href="https://smartapi.angelone.in"
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: "#7aa2f7" }}
                      >
                        smartapi.angelone.in
                      </a>{" "}
                      to get your API key.
                    </div>
                  </div>
                )}

                <div style={fieldStyle}>
                  <label style={labelStyle}>Client ID</label>
                  <input
                    type="text"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    placeholder="e.g. A123456"
                    style={inputStyle}
                    required
                    autoComplete="off"
                  />
                </div>

                <div style={fieldStyle}>
                  <label style={labelStyle}>PIN (MPIN)</label>
                  <input
                    type="password"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder="Your trading PIN"
                    style={inputStyle}
                    required
                    autoComplete="off"
                  />
                </div>

                <div style={fieldStyle}>
                  <label style={labelStyle}>TOTP Code</label>
                  <input
                    type="text"
                    value={totp}
                    onChange={(e) => setTotp(e.target.value)}
                    placeholder="6-digit code from your authenticator app"
                    style={inputStyle}
                    required
                    autoComplete="off"
                  />
                  <div style={{ color: "#666", fontSize: 12, marginTop: 6 }}>
                    Enable TOTP at{" "}
                    <a
                      href="https://smartapi.angelone.in/enable-totp"
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "#7aa2f7" }}
                    >
                      smartapi.angelone.in/enable-totp
                    </a>{" "}
                    (Google Authenticator).
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={busy}
                  style={{
                    width: "100%",
                    background: "#7aa2f7",
                    color: "#0a0a0a",
                    fontWeight: 700,
                    border: "none",
                    borderRadius: 8,
                    padding: "12px",
                    fontSize: 15,
                    cursor: busy ? "default" : "pointer",
                    opacity: busy ? 0.6 : 1,
                  }}
                >
                  {busy ? "Connecting..." : "Connect Angel One"}
                </button>
              </form>
            )}
          </>
        )}

        <p style={{ color: "#555", fontSize: 12, marginTop: "2rem", lineHeight: 1.6 }}>
          Credentials and session tokens are stored locally in the{" "}
          <code>.angelone/</code> folder (git-ignored) on the server only. The
          session is valid until midnight unless refreshed. Never share your API
          key or TOTP secret.
        </p>
      </div>
    </main>
  );
}
