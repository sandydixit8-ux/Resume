"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Header from "@/components/header"
import Footer from "@/components/footer"
import { CheckCircle2, Loader2, ArrowRight } from "lucide-react"

function SuccessContent() {
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading")

  useEffect(() => {
    const sessionId = searchParams.get("session_id")
    if (sessionId) setStatus("success")
    else setStatus("error")
  }, [searchParams])

  return (
    <Card className="w-full max-w-md border border-border/50 bg-transparent text-center">
      <h1 className="sr-only">Payment Status</h1>
      <CardHeader>
        {status === "loading" ? (
          <div className="flex justify-center mb-4"><Loader2 className="h-12 w-12 animate-spin text-emerald-400" /></div>
        ) : (
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-400" />
            </div>
          </div>
        )}
        <CardTitle className="text-2xl">
          {status === "loading" ? "Verifying..." : status === "success" ? "Subscription Active!" : "Something went wrong"}
        </CardTitle>
        <CardDescription>
          {status === "loading" ? "Please wait while we confirm your payment..." : ""}
          {status === "success" ? "Your plan is now active. Start using all Pro features." : ""}
          {status === "error" ? "No session ID found. Please try again." : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button asChild className="w-full bg-gradient-brand hover:opacity-90 text-white glow-brand">
          <Link href="/dashboard">
            Go to Dashboard <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
        <Button asChild variant="outline" className="w-full border-border">
          <Link href="/pricing">Back to Pricing</Link>
        </Button>
      </CardContent>
    </Card>
  )
}

export default function PricingSuccessPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main id="main-content" className="flex-1 flex items-center justify-center pt-24 pb-12 px-4">
        <Suspense fallback={
          <Card className="w-full max-w-md border border-border/50 bg-transparent text-center">
            <CardHeader>
              <div className="flex justify-center mb-4"><Loader2 className="h-12 w-12 animate-spin text-emerald-400" /></div>
              <CardTitle className="text-2xl">Loading...</CardTitle>
            </CardHeader>
          </Card>
        }>
          <SuccessContent />
        </Suspense>
      </main>
      <Footer />
    </div>
  )
}
