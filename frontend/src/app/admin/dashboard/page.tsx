"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Shield, Users, Eye, BarChart3, LogOut, ArrowLeft, Globe, Clock } from "lucide-react"
import { getAdminStats } from "@/lib/api"

export default function AdminDashboardPage() {
  const router = useRouter()
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem("admin_token")
    if (!token) { router.push("/admin/login"); return }
    getAdminStats(token)
      .then(setStats)
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
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{localStorage.getItem("admin_username")}</span>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" /> Logout
            </Button>
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" /> Site
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 pt-12 pb-12">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
            <p className="text-muted-foreground mb-8">Visitor analytics and site overview</p>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <Card className="border border-border/50 bg-transparent">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Visits</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Eye className="h-5 w-5 text-emerald-400" />
                    <span className="text-3xl font-bold text-gradient">{stats?.total_visits ?? 0}</span>
                  </div>
                </CardContent>
              </Card>
              <Card className="border border-border/50 bg-transparent">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Today</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-cyan-400" />
                    <span className="text-3xl font-bold text-cyan-400">{stats?.today_visits ?? 0}</span>
                  </div>
                </CardContent>
              </Card>
              <Card className="border border-border/50 bg-transparent">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Unique Visitors</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-amber-400" />
                    <span className="text-3xl font-bold text-amber-400">{stats?.unique_visitors ?? 0}</span>
                  </div>
                </CardContent>
              </Card>
              <Card className="border border-border/50 bg-transparent">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Pages Tracked</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Globe className="h-5 w-5 text-violet-400" />
                    <span className="text-3xl font-bold text-violet-400">{stats?.top_pages?.length ?? 0}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              <Card className="border border-border/50 bg-transparent">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <BarChart3 className="h-4 w-4 text-emerald-400" />
                    Top Pages
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {stats?.top_pages?.length > 0 ? (
                    <div className="space-y-2">
                      {stats.top_pages.map((p: any, i: number) => (
                        <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
                          <span className="text-sm font-mono truncate max-w-[70%]">{p.path}</span>
                          <Badge className="bg-emerald-900/40 text-emerald-400 border-0">{p.count} views</Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm text-center py-8">No visits yet</p>
                  )}
                </CardContent>
              </Card>

              <Card className="border border-border/50 bg-transparent">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-cyan-400" />
                    Recent Visits
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {stats?.recent_visits?.length > 0 ? (
                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                      {stats.recent_visits.map((v: any, i: number) => (
                        <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50 text-xs">
                          <span className="font-mono truncate max-w-[40%]">{v.path}</span>
                          <span className="text-muted-foreground truncate max-w-[30%]">{v.ip || "—"}</span>
                          <span className="text-muted-foreground">{v.timestamp ? new Date(v.timestamp).toLocaleString() : "—"}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm text-center py-8">No visits yet</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
