import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = { title: "Create account" };

export default async function SignupPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Start your free trial</CardTitle>
        <CardDescription>
          Run sales, orders, inventory and follow-ups from one place — mobile-first.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SignupForm />
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-[var(--primary)] hover:underline">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}