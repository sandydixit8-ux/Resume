"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import Header from "@/components/header"
import Footer from "@/components/footer"
import {
  Target, Loader2, Sparkles, CheckCircle2, XCircle, AlertTriangle, ArrowRight,
} from "lucide-react"
import { matchJD } from "@/lib/api"

export default function JDMatchPage() {
  const [resumeId, setResumeId] = useState("")
  const [jdText, setJdText] = useState("")
  const [jdTitle, setJdTitle] = useState("")
  const [jdCompany, setJdCompany] = useState("")
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleMatch() {
    if (!jdText.trim() || !resumeId.trim()) return
    setLoading(true); setResult(null); setError(null)
    try {
      const r = await matchJD(Number(resumeId), jdText, jdTitle, jdCompany)
      setResult(r)
    } catch (err: any) { setError(err.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main id="main-content" className="flex-1 pt-24 pb-12">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 text-sm font-medium text-emerald-300 mb-4">
              <Target className="h-3.5 w-3.5" />
              JD Matching
            </div>
            <h1 className="text-3xl md:text-5xl font-bold">Match Resume to Job Description</h1>
            <p className="mt-3 text-muted-foreground text-lg max-w-2xl mx-auto">
              Compare your resume against any job description and get a detailed match score
            </p>
          </div>

          <Card className="border border-border/50 bg-transparent mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-emerald-400" />
                Job Description
              </CardTitle>
              <CardDescription>Paste a job description to analyze the match</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Resume ID</label>
                <input
                  className="flex h-9 w-full rounded-md border border-input bg-background/50 px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                  placeholder="Enter the resume ID from analysis (or go to Analyze first)"
                  value={resumeId}
                  onChange={(e) => setResumeId(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Job Title</label>
                  <input
                    className="flex h-9 w-full rounded-md border border-input bg-background/50 px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                    placeholder="e.g. Senior Software Engineer"
                    value={jdTitle}
                    onChange={(e) => setJdTitle(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Company</label>
                  <input
                    className="flex h-9 w-full rounded-md border border-input bg-background/50 px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                    placeholder="e.g. Acme Corp"
                    value={jdCompany}
                    onChange={(e) => setJdCompany(e.target.value)}
                  />
                </div>
              </div>
              <Textarea
                placeholder="Paste the full job description here..."
                className="min-h-[200px] bg-background/50"
                value={jdText}
                onChange={(e) => setJdText(e.target.value)}
              />
              <Button onClick={handleMatch} disabled={!jdText.trim() || !resumeId.trim() || loading} className="w-full bg-gradient-brand hover:opacity-90 text-white shadow-lg glow-brand">
                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Matching...</> : <><Sparkles className="mr-2 h-4 w-4" /> Analyze Match</>}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Don&apos;t have a Resume ID?{" "}
                <Link href="/analyze" className="text-emerald-400 hover:text-emerald-300">Analyze a resume first</Link>
              </p>
            </CardContent>
          </Card>

          {error && (
            <div className="mb-6 p-4 bg-red-950/30 border border-red-800/50 rounded-xl flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
              <span className="text-sm text-red-400">{error}</span>
            </div>
          )}

          {result && (
            <div className="space-y-6">
              <Card className="border border-border/50 bg-transparent">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Target className="h-5 w-5 text-emerald-400" />
                      Match Score
                    </span>
                    <span className={`text-3xl font-extrabold ${
                      result.match_score >= 70 ? "text-emerald-400" :
                      result.match_score >= 50 ? "text-amber-400" : "text-red-400"
                    }`}>{result.match_score}%</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="relative h-3 rounded-full bg-muted overflow-hidden">
                    <div className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${
                      result.match_score >= 70 ? "from-emerald-500 to-teal-500" :
                      result.match_score >= 50 ? "from-amber-400 to-orange-500" :
                      "from-red-500 to-rose-500"
                    } transition-all duration-1000`} style={{ width: `${result.match_score}%` }} />
                  </div>
                </CardContent>
              </Card>

              <div className="grid md:grid-cols-2 gap-6">
                {result.matched_keywords?.length > 0 && (
                  <Card className="border-0 bg-gradient-to-br from-emerald-950/30 to-teal-950/20">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-emerald-400">
                        <CheckCircle2 className="h-5 w-5" />
                        Matched ({result.matched_keywords.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {result.matched_keywords.map((k: any, i: number) => (
                          <Badge key={i} className="bg-emerald-900/40 text-emerald-400 border-0">{k.skill}</Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
                {result.hard_requirements?.length > 0 && (
                  <Card className="border-0 bg-gradient-to-br from-red-950/30 to-rose-950/20">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-red-400">
                        <XCircle className="h-5 w-5" />
                        Missing ({result.hard_requirements.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {result.hard_requirements.map((r: any, i: number) => (
                          <Badge key={i} className="bg-red-900/40 text-red-400 border-0">{r.skill}</Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              <div className="text-center">
                <Button asChild variant="outline">
                  <Link href={`/results/${resumeId}`}>
                    View Full Results <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}
