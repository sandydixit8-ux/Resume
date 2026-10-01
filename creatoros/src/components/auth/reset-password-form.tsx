"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";

function ResetPasswordInner() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") || "";
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!token) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-navy-700">This reset link is missing its token. Request a new one.</p>
        <Link href="/auth/forgot-password" className="btn-primary block w-full py-2.5">Request a new link</Link>
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password") || "");
    const confirm = String(form.get("confirm") || "");

    if (password !== confirm) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error?.message || "Something went wrong");
        setLoading(false);
        return;
      }
      router.push("/auth/login?reset=1");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="label" htmlFor="password">New password</label>
        <input id="password" name="password" type="password" required minLength={10} autoComplete="new-password" className="input" placeholder="At least 10 characters" />
      </div>
      <div>
        <label className="label" htmlFor="confirm">Confirm new password</label>
        <input id="confirm" name="confirm" type="password" required minLength={10} autoComplete="new-password" className="input" placeholder="Type it again" />
      </div>
      {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Set new password"}
      </button>
      <p className="text-center text-xs text-navy-500">
        This also signs you out everywhere else.
      </p>
    </form>
  );
}

export function ResetPasswordForm() {
  return (
    <Suspense fallback={<div className="py-6 text-center text-sm text-navy-500">Loading…</div>}>
      <ResetPasswordInner />
    </Suspense>
  );
}
