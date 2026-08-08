"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Shield, Loader2, AlertCircle, ArrowLeft, CheckCircle2, KeyRound } from "lucide-react"

export default function ResetPasswordPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function handleSubmit() {
    if (!email.trim() || !code.trim() || !newPassword.trim()) return
    setLoading(true); setError(null)
    try {
      const res = await fetch("/api/v1/admin/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, new_password: newPassword }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.detail || "Failed")
      }
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed")
    } finally { setLoading(false) }
  }

  return (
    <main id="main-content" className="flex min-h-screen items-center justify-center bg-background p-4">
      <h1 className="sr-only">Reset Password</h1>
      <Card className="w-full max-w-sm border border-border/50 bg-transparent">
        <CardHeader className="text-center">
          <div className="w-12 h-12 rounded-xl bg-gradient-brand flex items-center justify-center mx-auto mb-3 glow-brand">
            <Shield className="h-6 w-6 text-white" />
          </div>
          <CardTitle className="text-xl">Reset Password</CardTitle>
          <CardDescription>Enter the code from your email and set a new password</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="p-3 bg-red-950/30 border border-red-800/50 rounded-lg flex items-start gap-2 text-sm">
              <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
              <span className="text-red-400">{error}</span>
            </div>
          )}
          {done ? (
            <div className="text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-7 w-7 text-emerald-400" />
              </div>
              <p className="text-sm text-muted-foreground">Password reset successfully!</p>
              <Button className="w-full bg-gradient-brand hover:opacity-90 text-white glow-brand" onClick={() => router.push("/admin/login")}>
                Sign In with New Password
              </Button>
            </div>
          ) : (
            <>
              <div>
                <label className="text-sm font-medium mb-1 block">Email</label>
                <input
                  type="email"
                  className="flex h-9 w-full rounded-md border border-input bg-background/50 px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                  placeholder="admin@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Reset Code</label>
                <input
                  className="flex h-9 w-full rounded-md border border-input bg-background/50 px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 font-mono tracking-widest text-center"
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">New Password</label>
                <input
                  type="password"
                  className="flex h-9 w-full rounded-md border border-input bg-background/50 px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                  placeholder="••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                />
              </div>
              <Button onClick={handleSubmit} disabled={!email.trim() || !code.trim() || !newPassword.trim() || loading} className="w-full bg-gradient-brand hover:opacity-90 text-white glow-brand">
                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Resetting...</> : <><KeyRound className="mr-2 h-4 w-4" /> Reset Password</>}
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
