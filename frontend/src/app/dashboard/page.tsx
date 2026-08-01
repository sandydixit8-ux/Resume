"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Header from "@/components/header"
import Footer from "@/components/footer"
import {
  FileText, TrendingUp, Target, Sparkles, ArrowRight, BarChart3,
  Loader2, Search, Plus,
} from "lucide-react"
import { getAnalysis } from "@/lib/api"

export default function DashboardPage() {
  const [stats, setStats] = useState<any>({ total: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        // For now, show placeholder stats
        setStats({ total: 3, analyzed: 2, matched: 1, letters: 1 })
      } catch { }
      finally { setLoading(false) }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header />
        <main className="flex-1 flex items-center justify-center pt-20">
          <div className="flex flex-col items-center gap-4">
            <div className="h-10 w-10 rounded-full border-4 border-emerald-800 border-t-emerald-500 animate-spin" />
            <p className="text-muted-foreground">Loading dashboard...</p>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header />

      <main id="main-content" className="flex-1 pt-24 pb-12">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-3xl font-bold">Dashboard</h1>
                <p className="text-muted-foreground mt-1">Your resume analysis overview</p>
              </div>
              <Button asChild className="bg-gradient-brand hover:opacity-90 text-white glow-brand">
                <Link href="/analyze">
                  <Plus className="mr-2 h-4 w-4" /> New Analysis
                </Link>
              </Button>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <Card className="border border-border/50 bg-transparent">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Resumes Analyzed</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-gradient">{stats.total}</div>
                </CardContent>
              </Card>
              <Card className="border border-border/50 bg-transparent">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Interviews Secured</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-gradient-warm">0</div>
                </CardContent>
              </Card>
              <Card className="border border-border/50 bg-transparent">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Applications Tracked</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-cyan-400">0</div>
                </CardContent>
              </Card>
              <Card className="border border-border/50 bg-transparent">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Skills Identified</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-emerald-400">0</div>
                </CardContent>
              </Card>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              <Card className="border border-border/50 bg-transparent">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-emerald-400" />
                    Quick Actions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Link href="/analyze" className="flex items-center justify-between p-4 rounded-xl bg-muted/50 hover:bg-muted/80 transition-colors group">
                    <div className="flex items-center gap-3">
                      <Search className="h-5 w-5 text-emerald-400" />
                      <div>
                        <p className="font-medium text-sm">Analyze Resume</p>
                        <p className="text-xs text-muted-foreground">Get ATS score and feedback</p>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-emerald-400 transition-colors" />
                  </Link>
                  <Link href="/jd-match" className="flex items-center justify-between p-4 rounded-xl bg-muted/50 hover:bg-muted/80 transition-colors group">
                    <div className="flex items-center gap-3">
                      <Target className="h-5 w-5 text-cyan-400" />
                      <div>
                        <p className="font-medium text-sm">JD Match</p>
                        <p className="text-xs text-muted-foreground">Match resume to job description</p>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-cyan-400 transition-colors" />
                  </Link>
                  <Link href="/cover-letter" className="flex items-center justify-between p-4 rounded-xl bg-muted/50 hover:bg-muted/80 transition-colors group">
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-amber-400" />
                      <div>
                        <p className="font-medium text-sm">Cover Letter</p>
                        <p className="text-xs text-muted-foreground">Generate tailored cover letters</p>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-amber-400 transition-colors" />
                  </Link>
                  <Link href="/builder" className="flex items-center justify-between p-4 rounded-xl bg-muted/50 hover:bg-muted/80 transition-colors group">
                    <div className="flex items-center gap-3">
                      <Sparkles className="h-5 w-5 text-violet-400" />
                      <div>
                        <p className="font-medium text-sm">Resume Builder</p>
                        <p className="text-xs text-muted-foreground">Build professional resumes</p>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-violet-400 transition-colors" />
                  </Link>
                </CardContent>
              </Card>

              <Card className="border border-border/50 bg-transparent">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-emerald-400" />
                    Activity
                  </CardTitle>
                  <CardDescription>Your recent activity will appear here</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                  <BarChart3 className="h-10 w-10 text-muted-foreground/40 mb-3" />
                  <p className="text-muted-foreground text-sm">No activity yet</p>
                  <p className="text-muted-foreground text-xs mt-1">Start by analyzing your first resume</p>
                  <Button asChild size="sm" className="mt-4 bg-gradient-brand hover:opacity-90 text-white glow-brand">
                    <Link href="/analyze">
                      Analyze Resume <ArrowRight className="ml-2 h-3 w-3" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
