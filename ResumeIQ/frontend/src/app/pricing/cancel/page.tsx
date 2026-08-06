"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Header from "@/components/header"
import Footer from "@/components/footer"
import { XCircle, ArrowLeft } from "lucide-react"

export default function PricingCancelPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main id="main-content" className="flex-1 flex items-center justify-center pt-24 pb-12 px-4">
        <Card className="w-full max-w-md border border-border/50 bg-transparent text-center">
          <h1 className="sr-only">Checkout Cancelled</h1>
          <CardHeader>
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center">
                <XCircle className="h-10 w-10 text-amber-400" />
              </div>
            </div>
            <CardTitle className="text-2xl">Checkout Cancelled</CardTitle>
            <CardDescription>No charges were made. Your current plan remains active.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button asChild className="w-full bg-gradient-brand hover:opacity-90 text-white glow-brand">
              <Link href="/pricing">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Pricing
              </Link>
            </Button>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  )
}
