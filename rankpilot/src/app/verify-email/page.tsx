"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { api } from "@/lib/client";

function VerifyPanel() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState<"idle" | "working" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  // A ref, not state: this must fire once per token, and a second render pass
  // from a state change would otherwise re-submit the same token.
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current || !token) return;
    sent.current = true;
    setState("working");
    void (async () => {
      const res = await api("/api/auth/verify-email", { json: { token } });
      if (res.ok) {
        setState("done");
      } else {
        setState("error");
        setMessage(res.error.message);
      }
    })();
  }, [token]);

  if (!token) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-ink-600">This link is missing its token.</p>
        <Link className="btn-primary block w-full text-center" href="/login">
          Go to sign in
        </Link>
      </div>
    );
  }

  if (state === "working") {
    return <p className="text-sm text-ink-600">Confirming your email address&hellip;</p>;
  }

  if (state === "done") {
    return (
      <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
        Email address verified. You can sign in now.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {message ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{message}</p>
      ) : null}
      <Link className="btn-primary block w-full text-center" href="/login">
        Go to sign in
      </Link>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-50 px-4">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-6 flex items-center justify-center gap-2 font-semibold text-ink-900">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">R</span>
          RankPilot AI
        </Link>
        <div className="card p-6">
          <h1 className="text-lg font-semibold text-ink-900">Email verification</h1>
          <p className="mb-5 mt-1 text-sm text-ink-500">Confirming the address on your account.</p>
          <Suspense>
            <VerifyPanel />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
