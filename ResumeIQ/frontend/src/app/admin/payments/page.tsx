"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Shield, Users, LogOut, ArrowLeft, CreditCard, IndianRupee, TrendingUp, Activity } from "lucide-react"
import { getAdminFinancials } from "@/lib/api"

type PlanBreakdown = { price: number; count: number; revenue: number }

type Financials = {
  active_subscribers?: number
  mrr?: number
  total_subscribers?: number
  plan_breakdown?: Record<string, PlanBreakdown>
  signup_trend?: { date: string; signups: number }[]
  recent_subscriptions?: { email: string; plan: string; status: string; created_at?: string | null }[]
}

export default function AdminPaymentsPage() {
  const router = useRouter()
  const [financials, setFinancials] = useState<Financials | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem("admin_token")
    if (!token) { router.push("/admin/login"); return }
    getAdminFinancials(token)
      .then(setFinancials)
      .catch(() => { localStorage.removeItem("admin_token"); router.push("/admin/login") })
      .finally(() => setLoading(false))
  }, [router])

  function handleLogout() {
    localStorage.removeItem("admin_token")
    localStorage.removeItem("admin_username")
    router.push("/admin/login")
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-10 w-10 rounded-full border-4 border-emerald-800 border-t-emerald-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen">
      <header className="glass">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-emerald-400" />
            <span className="font-bold text-gradient">Admin</span>
          </Link>
          <nav className="flex items-center gap-1 rounded-full bg-muted/50 p-1">
            <Link href="/admin/dashboard" className="px-3 py-1 text-sm font-medium rounded-full text-muted-foreground hover:text-foreground">
              Dashboard
            </Link>
            <Link href="/admin/payments" className="px-3 py-1 text-sm font-medium rounded-full bg-emerald-900/40 text-emerald-400">
              Payments
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{localStorage.getItem("admin_username")}</span>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" /> Logout
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/">
                <ArrowLeft className="mr-2 h-4 w-4" /> Site
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main id="main-content" className="flex-1 pt-12 pb-12">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
              <CreditCard className="h-7 w-7 text-emerald-400" />
              Payments & Revenue
            </h1>
            <p className="text-muted-foreground mb-8">Financial status from subscriptions</p>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <Card className="border border-border/50 bg-transparent">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Active Subscribers</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-emerald-400" />
                    <span className="text-3xl font-bold text-gradient">{financials?.active_subscribers ?? 0}</span>
                  </div>
                </CardContent>
              </Card>
              <Card className="border border-border/50 bg-transparent">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Monthly Recurring Revenue</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <IndianRupee className="h-5 w-5 text-cyan-400" />
                    <span className="text-3xl font-bold text-cyan-400">{financials?.mrr?.toLocaleString("en-IN") ?? 0}</span>
                  </div>
                </CardContent>
              </Card>
              <Card className="border border-border/50 bg-transparent">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Subscribers</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-amber-400" />
                    <span className="text-3xl font-bold text-amber-400">{financials?.total_subscribers ?? 0}</span>
                  </div>
                </CardContent>
              </Card>
              <Card className="border border-border/50 bg-transparent">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Revenue Streak</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-violet-400" />
                    <span className="text-3xl font-bold text-violet-400">7d</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              <Card className="border border-border/50 bg-transparent">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <IndianRupee className="h-4 w-4 text-emerald-400" />
                    Plan Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {financials?.plan_breakdown ? (
                    <div className="space-y-3">
                      {Object.entries(financials.plan_breakdown).map(([plan, p]) => (
                        <div key={plan} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
                          <div>
                            <div className="text-sm font-semibold capitalize">{plan}</div>
                            <div className="text-xs text-muted-foreground">
                              ₹{p.price.toLocaleString("en-IN")}/mo
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold">{p.count} active</div>
                            <div className="text-xs text-emerald-400">₹{p.revenue.toLocaleString("en-IN")}/mo</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm text-center py-8">No data</p>
                  )}
                </CardContent>
              </Card>

              <Card className="border border-border/50 bg-transparent">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <TrendingUp className="h-4 w-4 text-cyan-400" />
                    Signups — Last 7 Days
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {financials?.signup_trend?.length ? (
                    <div className="flex items-end justify-between gap-2 h-40">
                      {financials.signup_trend.map((d, i: number) => {
                        const max = Math.max(...financials.signup_trend!.map((x) => x.signups), 1)
                        const h = Math.max(4, (d.signups / max) * 100)
                        return (
                          <div key={i} className="flex flex-col items-center gap-2 flex-1">
                            <div className="flex flex-col items-center justify-end h-28 w-full">
                              <span className="text-xs font-bold text-cyan-400">{d.signups}</span>
                              <div
                                className="w-full max-w-[40px] rounded-t-md bg-gradient-to-t from-emerald-700 to-emerald-400"
                                style={{ height: `${h}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(d.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm text-center py-8">No data</p>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="border border-border/50 bg-transparent mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <CreditCard className="h-4 w-4 text-violet-400" />
                  Recent Subscriptions
                </CardTitle>
              </CardHeader>
              <CardContent>
                {financials?.recent_subscriptions?.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border/50 text-left text-xs text-muted-foreground">
                          <th className="py-2 pr-4 font-medium">Email</th>
                          <th className="py-2 pr-4 font-medium">Plan</th>
                          <th className="py-2 pr-4 font-medium">Status</th>
                          <th className="py-2 font-medium">Signed Up</th>
                        </tr>
                      </thead>
                      <tbody>
                        {financials.recent_subscriptions.map((s, i: number) => (
                          <tr key={i} className="border-b border-border/20 last:border-0">
                            <td className="py-2 pr-4 font-mono text-xs truncate max-w-[220px]">{s.email}</td>
                            <td className="py-2 pr-4 capitalize">{s.plan}</td>
                            <td className="py-2 pr-4">
                              <Badge className={s.status === "active" ? "bg-emerald-900/40 text-emerald-400 border-0" : "bg-red-900/40 text-red-400 border-0"}>
                                {s.status}
                              </Badge>
                            </td>
                            <td className="py-2 text-muted-foreground text-xs">
                              {s.created_at ? new Date(s.created_at).toLocaleString() : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm text-center py-8">No subscriptions yet</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
