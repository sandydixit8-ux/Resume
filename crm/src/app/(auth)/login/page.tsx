import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Welcome back</CardTitle>
        <CardDescription>Sign in to manage leads, orders and follow-ups.</CardDescription>
      </CardHeader>
      <CardContent>
        <LoginForm />
        <p className="mt-4 text-center text-xs text-muted-foreground">
          New here?{" "}
          <Link href="/signup" className="font-medium text-[var(--primary)] hover:underline">
            Create an account
          </Link>
        </p>
        <p className="mt-2 text-center text-xs">
          <Link href="/forgot-password" className="text-muted-foreground hover:underline">
            Forgot password?
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}