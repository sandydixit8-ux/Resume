import Link from "next/link";
import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "All set" };

export default function CompletePage() {
  return (
    <Card>
      <CardHeader className="items-center text-center">
        <CheckCircle2 className="mb-1 h-12 w-12 text-[var(--success)]" />
        <CardTitle className="text-lg">You&apos;re all set</CardTitle>
        <CardDescription>
          Your business is ready. Here are a few quick wins to get started:
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <Link href="/leads/new" className="block">
          <Button variant="outline" className="w-full">
            Add your first lead
          </Button>
        </Link>
        <Link href="/products" className="block">
          <Button variant="outline" className="w-full">
            Browse products &amp; inventory
          </Button>
        </Link>
        <Link href="/admin/settings" className="block">
          <Button variant="outline" className="w-full">
            Connect WhatsApp &amp; GST
          </Button>
        </Link>
        <Link href="/" className="block">
          <Button className="w-full">Go to dashboard</Button>
        </Link>
      </CardContent>
    </Card>
  );
}