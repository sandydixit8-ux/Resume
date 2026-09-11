"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";

/**
 * Verification screen. Handles:
 *  - one-time email codes sent for password reset / login (verifyOtp),
 *  - exchange of `code` query params from magic links.
 */
export function VerifyForm() {
  const params = useSearchParams();
  const codeParam = params.get("code");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState(codeParam ?? "");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();

      if (codeParam) {
        const { error } = await supabase.auth.exchangeCodeForSession(codeParam);
        if (error) throw error;
        setDone(true);
        return;
      }

      if (token !== codeParam) {
        // We're accepting OTP-style codes sent by email.
        const { data, error: otpError } = await supabase.auth.verifyOtp({
          email,
          token,
          type: "email",
        });
        if (otpError) throw otpError;
        if (data.session) {
          setDone(true);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed. Check the code and try again.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
        Verified!{" "}
        <Link href="/" className="font-medium underline">
          Continue to your dashboard
        </Link>
        .
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {!codeParam ? (
        <>
          <Field label="Email" required>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Field label="Verification code" required>
            <Input value={token} onChange={(e) => setToken(e.target.value)} inputMode="numeric" required />
          </Field>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">
          Exchanging your verification link… click the button to continue.
        </p>
      )}
      <Field label="New password" hint="Optional — leave blank to keep current password">
        <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" />
      </Field>
      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      ) : null}
      <Button type="submit" size="lg" loading={loading} className="w-full">
        {codeParam ? "Continue" : "Verify"}
      </Button>
    </form>
  );
}