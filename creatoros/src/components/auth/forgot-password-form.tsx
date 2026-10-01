"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, CheckCircle2 } from "lucide-react";

/**
 * Requests a reset link. The API always reports success so this form cannot be
 * used to discover which emails have accounts.
 */
export function ForgotPasswordForm() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") || "");

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error?.message || "Something went wrong");
        return;
      }
      setSent(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="space-y-4 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-green-600" />
        <p className="text-sm text-navy-700">
          If that email has a CreatorOS account, a reset link is on its way. It expires in 60 minutes.
        </p>
        <Link href="/auth/login" className="btn-primary block w-full py-2.5">
          Back to log in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required autoComplete="email" className="input" placeholder="you@example.com" />
      </div>
      {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send reset link"}
      </button>
      <p className="text-center text-xs text-navy-500">
        <Link href="/auth/login" className="font-medium text-brand-600 hover:text-brand-700">Back to log in</Link>
      </p>
    </form>
  );
}
