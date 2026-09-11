"use client";

import { useActionState } from "react";
import { createBranch } from "@/lib/actions/onboarding";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";

export function BranchForm() {
  const [state, formAction, pending] = useActionState(createBranch, null);

  return (
    <form action={formAction}>
      <Card>
        <CardHeader>
          <CardTitle>Create your first branch</CardTitle>
          <CardDescription>
            Multi-branch businesses can add more later. Your team and stock are organized by branch.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Branch name" required>
            <Input name="name" placeholder="Delhi Head Office" required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="City">
              <Input name="city" placeholder="Delhi" />
            </Field>
            <Field label="State">
              <Input name="state" placeholder="Delhi" />
            </Field>
          </div>
          <Field label="Address">
            <Input name="address" placeholder="123, Karol Bagh" />
          </Field>
          <Field label="Pincode">
            <Input name="pincode" placeholder="110005" />
          </Field>
          {state && "error" in state ? (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
              {state.error}
            </p>
          ) : null}
        </CardContent>
        <div className="border-t border-[var(--border)] p-4">
          <Button type="submit" loading={pending} size="lg" className="w-full">
            Create branch
          </Button>
        </div>
      </Card>
    </form>
  );
}