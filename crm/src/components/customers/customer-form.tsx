"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { createCustomer } from "@/lib/actions/crm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/form";

export function CustomerForm() {
  const router = useRouter();
  const [state, , pending] = useActionState(createCustomer, null);

  return (
    <form
      action={async (fd) => {
        const res = await createCustomer(null, fd);
        if (res?.success && "id" in res && typeof res.id === "string") {
          router.push(`/customers/${res.id}`);
        }
      }}
    >
      <Card>
        <CardHeader>
          <CardTitle>New customer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Customer name" required>
              <Input name="name" placeholder="Gupta Traders" required />
            </Field>
            <Field label="Company">
              <Input name="company" placeholder="Gupta Traders" />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Mobile">
              <Input name="mobile" inputMode="tel" placeholder="98765 43210" />
            </Field>
            <Field label="Email">
              <Input name="email" type="email" placeholder="sales@company.in" />
            </Field>
          </div>
          <Field label="Address">
            <Textarea name="address" placeholder="Shop / office address" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="City">
              <Input name="city" placeholder="Delhi" />
            </Field>
            <Field label="State">
              <Input name="state" placeholder="Delhi" />
            </Field>
            <Field label="Pincode">
              <Input name="pincode" placeholder="110005" />
            </Field>
          </div>
          <Field label="GSTIN">
            <Input name="gstin" placeholder="07AABCS1429B1Z5" maxLength={15} />
          </Field>
          {state && "error" in state ? (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
              {state.error}
            </p>
          ) : null}
        </CardContent>
        <div className="flex gap-2 border-t border-[var(--border)] p-4">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" loading={pending} className="flex-1">
            Save customer
          </Button>
        </div>
      </Card>
    </form>
  );
}