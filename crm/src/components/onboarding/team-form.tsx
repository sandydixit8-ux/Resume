"use client";

import { useActionState } from "react";
import { inviteTeammates, skipToProducts } from "@/lib/actions/onboarding";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";

export function TeamForm() {
  const [state, formAction, pending] = useActionState(inviteTeammates, null);

  return (
    <div className="space-y-4">
      <form action={formAction}>
        <Card>
          <CardHeader>
            <CardTitle>Invite your team</CardTitle>
            <CardDescription>
              Add sales executives and managers now, or do it later from Settings → Users.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Email (optional)" hint="They'll get an invitation to join this business.">
              <Input name="email" type="email" placeholder="sales@company.com" />
            </Field>
            <p className="text-xs text-muted-foreground">
              Invited teammates are added as Sales Executives. Managers and warehouse staff can be
              assigned from Settings → Users.
            </p>
            {state && "error" in state ? (
              <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                {state.error}
              </p>
            ) : null}
          </CardContent>
          <div className="flex gap-2 border-t border-[var(--border)] p-4">
            <Button type="submit" loading={pending} size="lg" className="flex-1">
              Send invite
            </Button>
          </div>
        </Card>
      </form>
      <form action={skipToProducts}>
        <Button type="submit" variant="ghost" className="w-full">
          Skip for now
        </Button>
      </form>
    </div>
  );
}