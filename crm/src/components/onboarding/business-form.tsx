"use client";

import { useActionState } from "react";
import { createBusiness } from "@/lib/actions/onboarding";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

export function BusinessForm() {
  const [state, formAction, pending] = useActionState(createBusiness, null);

  return (
    <form action={formAction}>
      <Card>
        <CardHeader>
          <CardTitle>Tell us about your business</CardTitle>
          <CardDescription>This is the organization that all leads, orders and inventory will belong to.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Business name" required>
            <Input name="name" placeholder="Sharma Distributors" required />
          </Field>
          <Field label="Industry" required>
            <Select name="industry" defaultValue="Distribution">
              {INDUSTRIES.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Legal name (optional)">
            <Input name="legal_name" placeholder="Sharma Distributors Pvt. Ltd." />
          </Field>
          <Field label="GSTIN (optional)" hint="You can add or verify this later in Settings.">
            <Input name="gstin" placeholder="07AABCS1429B1Z5" maxLength={15} />
          </Field>
          {state && "error" in state ? (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
              {state.error}
            </p>
          ) : null}
        </CardContent>
        <div className="border-t border-[var(--border)] p-4">
          <Button type="submit" loading={pending} size="lg" className="w-full">
            Continue
          </Button>
        </div>
      </Card>
    </form>
  );
}