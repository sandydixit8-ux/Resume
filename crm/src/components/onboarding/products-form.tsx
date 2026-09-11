"use client";

import { useActionState } from "react";
import { createSampleProducts } from "@/lib/actions/onboarding";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Sparkles, Upload } from "lucide-react";

export function ProductsForm() {
  const [state, formAction, pending] = useActionState(createSampleProducts, null);

  return (
    <div className="space-y-4">
      <form action={formAction}>
        <input type="hidden" name="sample" value="yes" />
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[var(--primary)]" />
              Load sample data
            </CardTitle>
            <CardDescription>
              Populate a realistic demo business — Sharma Distributors — with 25 products, 30
              customers, 50 leads, orders, invoices and follow-ups so you can explore the app.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-xs text-muted-foreground">
              <li>· 25 electrical, plumbing &amp; industrial products with stock</li>
              <li>· 50 leads with sources (WhatsApp, IndiaMART, Referral…) and scores</li>
              <li>· 30 customers, pipeline opportunities, quotations and invoices</li>
              <li>· Sample follow-ups and activity history</li>
            </ul>
          </CardContent>
          <div className="border-t border-[var(--border)] p-4">
            <Button type="submit" size="lg" loading={pending} className="w-full">
              Load sample data
            </Button>
          </div>
        </Card>
      </form>

      <form action={formAction}>
        <input type="hidden" name="sample" value="no" />
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              Start empty
            </CardTitle>
            <CardDescription>
              Add your own products and catalogue from Products, or import from Excel/CSV later.
            </CardDescription>
          </CardHeader>
          <div className="border-t border-[var(--border)] p-4">
            <Button type="submit" size="lg" variant="outline" loading={pending} className="w-full">
              Skip — go to dashboard
            </Button>
          </div>
        </Card>
      </form>

      {state && "error" in state ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}