"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { createLead } from "@/lib/actions/crm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";

const SOURCES = [
  "Website", "Facebook", "WhatsApp", "IndiaMART", "Referral",
  "Phone", "Email", "Walk-in", "Import", "Manual Entry", "API",
];

export function LeadForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(createLead, null);

  return (
    <form
      action={async (fd) => {
        const res = await createLead(null, fd);
        if (res?.success && "id" in res && typeof res.id === "string") {
          router.push(`/leads/${res.id}`);
        }
      }}
    >
      <Card>
        <CardHeader>
          <CardTitle>New lead</CardTitle>
          <CardDescription>Capture the essentials fast — you can enrich the lead later.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Lead name" required>
              <Input name="name" placeholder="Arjun Mehta" required />
            </Field>
            <Field label="Company">
              <Input name="company" placeholder="Mehta Electricals" />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Mobile" hint="10-digit Indian mobile; WhatsApp uses this if same">
              <Input name="mobile" inputMode="tel" placeholder="98765 43210" />
            </Field>
            <Field label="WhatsApp number">
              <Input name="whatsapp_number" inputMode="tel" placeholder="98765 43210" />
            </Field>
          </div>
          <Field label="Email">
            <Input name="email" type="email" placeholder="arjun@company.com" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Source" required>
              <Select name="source" defaultValue="WhatsApp">
                {SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Priority">
              <Select name="priority" defaultValue="COLD">
                <option value="HOT">HOT</option>
                <option value="WARM">WARM</option>
                <option value="COLD">COLD</option>
              </Select>
            </Field>
            <Field label="Lead value (₹)">
              <Input name="value" type="number" min={0} defaultValue={0} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="City">
              <Input name="city" placeholder="Delhi" />
            </Field>
            <Field label="Product interest">
              <Input name="product_interest" placeholder="e.g. PPR Pipes" />
            </Field>
          </div>
          <Field label="Notes">
            <Textarea name="notes" placeholder="What did they ask about?" />
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
            Save lead
          </Button>
        </div>
      </Card>
    </form>
  );
}