"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Header from "@/components/header"
import Footer from "@/components/footer"
import {
  FileText, TrendingUp, Target, Sparkles, ArrowRight, BarChart3,
  Search, Plus,
} from "lucide-react"
import { listResumes, listAnalyses } from "@/lib/api"

type ResumeSummary = {
  id: number
  original_filename: string
  file_type: string
  has_parsing_issues: boolean
  created_at: string | null
}

type AnalysisSummary = {
  id: number
  resume_id: number
  overall_score: number
  created_at: string | null
}

export default function DashboardPage() {
  const [stats, setStats] = useState<{ total: number; analyzed: number }>({ total: 0, analyzed: 0 })
  const [resumes, setResumes] = useState<ResumeSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [resumeList, analysisList] = await Promise.all([listResumes(), listAnalyses()])
        const analyzedIds = new Set((analysisList as AnalysisSummary[]).map((a) => a.resume_id))
        setResumes((resumeList as ResumeSummary[]) || [])
        setStats({
          total: resumeList?.length ?? 0,
          analyzed: analyzedIds.size,
        })
      } catch {
        setResumes([])
        setStats({ total: 0, analyzed: 0 })
      } finally {
        setLoading(false)
      }
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
                  <CardTitle className="text-sm font-medium text-muted-foreground">Resumes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-gradient">{stats.total}</div>
                </CardContent>
              </Card>
              <Card className="border border-border/50 bg-transparent">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Analyzed</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-gradient-warm">{stats.analyzed}</div>
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
                  <CardDescription>Your recent resume activity</CardDescription>
                </CardHeader>
                <CardContent>
                  {resumes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <BarChart3 className="h-10 w-10 text-muted-foreground/40 mb-3" />
                      <p className="text-muted-foreground text-sm">No activity yet</p>
                      <p className="text-muted-foreground text-xs mt-1">Start by analyzing your first resume</p>
                      <Button asChild size="sm" className="mt-4 bg-gradient-brand hover:opacity-90 text-white glow-brand">
                        <Link href="/analyze">
                          Analyze Resume <ArrowRight className="ml-2 h-3 w-3" />
                        </Link>
                      </Button>
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {resumes.slice(0, 5).map((r) => (
                        <li key={r.id}>
                          <Link
                            href={`/results/${r.id}`}
                            className="flex items-center justify-between p-3 rounded-xl bg-muted/50 hover:bg-muted/80 transition-colors group"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <FileText className="h-4 w-4 text-emerald-400 shrink-0" />
                              <div className="min-w-0">
                                <p className="font-medium text-sm truncate">{r.original_filename || `Resume ${r.id}`}</p>
                                <p className="text-xs text-muted-foreground">
                                  {r.created_at ? new Date(r.created_at).toLocaleDateString() : ""} ·{" "}
                                  {r.has_parsing_issues ? "Has parsing issues" : "Parsed"}
                                </p>
                              </div>
                            </div>
                            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-emerald-400 transition-colors shrink-0" />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
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
