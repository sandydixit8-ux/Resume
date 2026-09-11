import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { VerifyForm } from "@/components/auth/verify-form";

export const metadata: Metadata = { title: "Verify" };

export default async function VerifyPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Verification</CardTitle>
        <CardDescription>Enter the one-time code from your email to continue.</CardDescription>
      </CardHeader>
      <CardContent>
        <VerifyForm />
        <p className="mt-4 text-center text-xs">
          <Link href="/login" className="text-muted-foreground hover:underline">
            Back to sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}