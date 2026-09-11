"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";

const INDUSTRIES = [
  "Distribution",
  "Manufacturing",
  "Services",
  "Real Estate",
  "Construction",
  "Healthcare",
  "Education",
  "Retail",
  "Trading",
  "B2B Sales",
];

export function SignupForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgName, setOrgName] = useState("");
  const [industry, setIndustry] = useState("Distribution");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name, org_name: orgName, industry },
        },
      });
      if (error) throw error;

      // Bootstrap the user profile row (org is created during onboarding).
      const res = await fetch("/api/auth/post-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name }),
      });
      if (!res.ok) {
        console.warn("profile bootstrap issue", await res.text());
      }

      if (data.session) {
        window.location.assign("/onboarding/business");
      } else {
        setInfo(
          "Almost done! Check your email to confirm your account, then sign in. (Demo note: if email confirmation is disabled on your Supabase project, you will be redirected automatically.)"
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create your account.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Your name" required>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Rahul Sharma" required />
      </Field>
      <Field label="Business name" required>
        <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="Sharma Distributors" required />
      </Field>
      <Field label="Industry" required>
        <Select value={industry} onChange={(e) => setIndustry(e.target.value)}>
          {INDUSTRIES.map((i) => (
            <option key={i} value={i}>
              {i}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Work email" required>
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" required />
      </Field>
      <Field label="Password" hint="At least 8 characters" required>
        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
      </Field>
      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      ) : null}
      {info ? (
        <p role="status" className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
          {info}
        </p>
      ) : null}
      <Button type="submit" size="lg" loading={loading} className="w-full">
        Create account
      </Button>
    </form>
  );
}