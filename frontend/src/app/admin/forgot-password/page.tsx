"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Shield, Loader2, AlertCircle, ArrowLeft, CheckCircle2, Mail } from "lucide-react"

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  async function handleSubmit() {
    if (!email.trim()) return
    setLoading(true); setError(null); setSent(false)
    try {
      const res = await fetch("/api/v1/admin/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.detail || "Failed")
      }
      setSent(true)
    } catch (err: any) {
      setError(err.message)
    } finally { setLoading(false) }
  }

  return (
    <main id="main-content" className="flex min-h-screen items-center justify-center bg-background p-4">
      <h1 className="sr-only">Forgot Password</h1>
      <Card className="w-full max-w-sm border border-border/50 bg-transparent">
        <CardHeader className="text-center">
          <div className="w-12 h-12 rounded-xl bg-gradient-brand flex items-center justify-center mx-auto mb-3 glow-brand">
            <Shield className="h-6 w-6 text-white" />
          </div>
          <CardTitle className="text-xl">Forgot Password</CardTitle>
          <CardDescription>Enter your admin email to receive a reset code</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="p-3 bg-red-950/30 border border-red-800/50 rounded-lg flex items-start gap-2 text-sm">
              <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
              <span className="text-red-400">{error}</span>
            </div>
          )}
          {sent ? (
            <div className="text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-7 w-7 text-emerald-400" />
              </div>
              <p className="text-sm text-muted-foreground">Reset code sent! Check your email.</p>
              <Button className="w-full bg-gradient-brand hover:opacity-90 text-white glow-brand" onClick={() => router.push("/admin/reset-password")}>
                Enter Code
              </Button>
            </div>
          ) : (
            <>
              <div>
                <label className="text-sm font-medium mb-1 block">Admin Email</label>
                <input
                  type="email"
                  className="flex h-9 w-full rounded-md border border-input bg-background/50 px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                  placeholder="admin@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                />
              </div>
              <Button onClick={handleSubmit} disabled={!email.trim() || loading} className="w-full bg-gradient-brand hover:opacity-90 text-white glow-brand">
                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...</> : <><Mail className="mr-2 h-4 w-4" /> Send Reset Code</>}
              </Button>
            </>
          )}
          <div className="text-center">
            <Link href="/admin/login" className="text-sm text-muted-foreground hover:text-emerald-400 inline-flex items-center gap-1">
              <ArrowLeft className="h-3 w-3" /> Back to Login
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
