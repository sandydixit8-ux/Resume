"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Shield, Loader2, AlertCircle, KeyRound } from "lucide-react"
import { adminLogin } from "@/lib/api"

export default function AdminLoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleLogin() {
    if (!username.trim() || !password.trim()) return
    setLoading(true); setError(null)
    try {
      const result = await adminLogin(username, password)
      localStorage.setItem("admin_token", result.token)
      localStorage.setItem("admin_username", result.username)
      router.push("/admin/dashboard")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed")
    } finally { setLoading(false) }
  }

  return (
    <main id="main-content" className="flex min-h-screen items-center justify-center bg-background p-4">
      <h1 className="sr-only">Admin Login</h1>
      <Card className="w-full max-w-sm border border-border/50 bg-transparent">
        <CardHeader className="text-center">
          <div className="w-12 h-12 rounded-xl bg-gradient-brand flex items-center justify-center mx-auto mb-3 glow-brand">
            <Shield className="h-6 w-6 text-white" />
          </div>
          <CardTitle className="text-xl">Admin Login</CardTitle>
          <CardDescription>Sign in to access the admin dashboard</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="p-3 bg-red-950/30 border border-red-800/50 rounded-lg flex items-start gap-2 text-sm">
              <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
              <span className="text-red-400">{error}</span>
            </div>
          )}
          <div>
            <label className="text-sm font-medium mb-1 block">Username</label>
            <input
              className="flex h-9 w-full rounded-md border border-input bg-background/50 px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
              placeholder="admin"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Password</label>
            <input
              type="password"
              className="flex h-9 w-full rounded-md border border-input bg-background/50 px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
              placeholder="••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />
          </div>
          <div className="flex justify-end -mt-2">
            <Link href="/admin/forgot-password" className="text-xs text-muted-foreground hover:text-emerald-400 inline-flex items-center gap-1">
              <KeyRound className="h-3 w-3" /> Forgot password?
            </Link>
          </div>
          <Button onClick={handleLogin} disabled={!username.trim() || !password.trim() || loading} className="w-full bg-gradient-brand hover:opacity-90 text-white glow-brand">
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in...</> : "Sign In"}
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
