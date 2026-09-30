"use client";

import { useState } from "react";

const SDK_SRC = "https://sdk.cashfree.com/js/v3/cashfree.js";

type CashfrontInstance = {
  subscriptionsCheckout: (opts: {
    subsSessionId: string;
    redirectTarget?: "_self" | "_blank";
  }) => Promise<{ error?: { message?: string } } | void>;
};

declare global {
  interface Window {
    Cashfree?: (opts: { mode: "sandbox" | "production" }) => CashfrontInstance;
  }
}

function loadCashfront(mode: "sandbox" | "production"): Promise<CashfrontInstance> {
  return new Promise((resolve, reject) => {
    if (window.Cashfree) {
      resolve(window.Cashfree({ mode }));
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SDK_SRC}"]`);
    const script = existing || document.createElement("script");
    script.src = SDK_SRC;
    script.async = true;
    script.onload = () => {
      if (!window.Cashfree) {
        reject(new Error("Cashfront SDK failed to initialise"));
        return;
      }
      resolve(window.Cashfree({ mode }));
    };
    script.onerror = () => reject(new Error("Could not load the Cashfree checkout script"));
    if (!existing) document.head.appendChild(script);
  });
}

/**
 * Cashfree returns no hosted redirect URL for mandates, so plan upgrades go
 * through Cashfront's subscription checkout in the browser. Stripe still works
 * as a plain redirect, which is why the response is branched on provider.
 */
export default function PlanUpgradeButton({
  plan,
  mode,
  needsPhone,
}: {
  plan: string;
  mode: "sandbox" | "production";
  needsPhone: boolean;
}) {
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function start() {
    if (busy) return;
    setBusy(true);
    setError("");

    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, phone }),
      });
      const payload = (await res.json().catch(() => null)) as
        | { ok: true; data: { provider: string; sessionId: string | null; url: string | null } }
        | { ok: false; error: { message: string; details?: Record<string, string[]> } }
        | null;

      if (!payload) throw new Error("Unexpected server response");
      if (!payload.ok) {
        const details = payload.error.details;
        const first = details ? Object.values(details).flat()[0] : undefined;
        throw new Error(first || payload.error.message);
      }

      const { provider, sessionId, url } = payload.data;

      if (provider === "cashfree" && sessionId) {
        const cashfree = await loadCashfront(mode);
        const result = await cashfree.subscriptionsCheckout({
          subsSessionId: sessionId,
          redirectTarget: "_self",
        });
        if (result?.error) throw new Error(result.error.message || "Cashfree checkout was closed");
        return;
      }

      if (url) {
        window.location.href = url;
        return;
      }

      throw new Error("Checkout is unavailable right now");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <div className="mt-5">
      {needsPhone && (
        <input
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          placeholder="10-digit phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="mb-2 w-full rounded-lg border border-navy-200 px-3 py-2 text-sm text-navy-900 placeholder:text-navy-400 focus:border-brand-400 focus:outline-none"
          aria-label="Phone number"
        />
      )}
      <button type="button" onClick={start} disabled={busy} className="btn-secondary w-full disabled:opacity-60">
        {busy ? "Starting checkout…" : "Upgrade"}
      </button>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
