"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select } from "@/components/ui/select"
import {
  getResume,
  getAnalysis,
  analyzeResume,
  matchJD,
  getRewriteSuggestions,
  generateCoverLetter,
} from "@/lib/api"
import {
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileText,
  Copy,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Shield,
  Target,
  Lightbulb,
  Award,
} from "lucide-react"
import Link from "next/link"
import Header from "@/components/header"
import Footer from "@/components/footer"
import AIResumeTools from "@/components/ai-tools"

function ScoreGauge({ value, label }: { value: number; label: string }) {
  const color =
    value >= 80 ? "from-emerald-500 to-teal-500" :
    value >= 60 ? "from-amber-400 to-orange-500" :
    "from-red-500 to-rose-500"
  const textColor =
    value >= 80 ? "text-emerald-400" :
    value >= 60 ? "text-amber-400" :
    "text-red-400"
  return (
    <div className="space-y-1.5 group">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground truncate font-medium">{label}</span>
        <span className={`font-bold ${textColor}`}>{value}</span>
      </div>
      <div className="relative h-2.5 rounded-full bg-muted overflow-hidden">
        <div
          className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${color} transition-all duration-1000 ease-out`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  )
}

export default function ResultsPage() {
  const params = useParams()
  const resumeId = Number(params.id)

  const [loading, setLoading] = useState(true)
  const [resume, setResume] = useState<any>(null)
  const [analysis, setAnalysis] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("ats")

  const [jdText, setJdText] = useState("")
  const [jdTitle, setJdTitle] = useState("")
  const [jdCompany, setJdCompany] = useState("")
  const [jdMatch, setJdMatch] = useState<any>(null)
  const [jdLoading, setJdLoading] = useState(false)

  const [rewrites, setRewrites] = useState<any[]>([])
  const [rewritesLoading, setRewritesLoading] = useState(false)

  const [clTone, setClTone] = useState("formal")
  const [clLength, setClLength] = useState("medium")
  const [coverLetter, setCoverLetter] = useState("")
  const [clLoading, setClLoading] = useState(false)
  const [clCopied, setClCopied] = useState(false)

  useEffect(() => { loadData() }, [resumeId])

  async function loadData() {
    setLoading(true)
    try {
      const [res, an] = await Promise.all([getResume(resumeId), getAnalysis(resumeId)])
      setResume(res)
      if (an) setAnalysis(an)
      else { const n = await analyzeResume(resumeId); setAnalysis(n) }
    } catch (err: any) { setError(err.message) }
    finally { setLoading(false) }
  }

  async function handleJDMatch() {
    if (!jdText.trim()) return
    setJdLoading(true); setJdMatch(null)
    try {
      const r = await matchJD(resumeId, jdText, jdTitle, jdCompany)
      setJdMatch(r); setActiveTab("jd-match")
    } catch (err: any) { setError(err.message) }
    finally { setJdLoading(false) }
  }

  async function handleRewrite() {
    setRewritesLoading(true); setRewrites([])
    try {
      const r = await getRewriteSuggestions(resumeId, jdText)
      setRewrites(r.suggestions || []); setActiveTab("rewrites")
    } catch (err: any) { setError(err.message) }
    finally { setRewritesLoading(false) }
  }

  async function handleCoverLetter() {
    if (!jdText.trim()) return
    setClLoading(true); setCoverLetter("")
    try {
      const r = await generateCoverLetter({ resume_id: resumeId, jd_text: jdText, jd_title: jdTitle, company_name: jdCompany, tone: clTone, length: clLength })
      setCoverLetter(r.content); setActiveTab("cover-letter")
    } catch (err: any) { setError(err.message) }
    finally { setClLoading(false) }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text)
    setClCopied(true)
    setTimeout(() => setClCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 animate-scale-in">
          <div className="relative">
            <div className="h-12 w-12 rounded-full border-4 border-emerald-800 border-t-emerald-500 animate-spin" />
          </div>
          <p className="text-muted-foreground font-medium">Loading your analysis...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
        <div className="p-4 rounded-full bg-red-900/30">
          <XCircle className="h-10 w-10 text-red-500" />
        </div>
        <p className="text-lg font-medium">{error}</p>
        <Button asChild variant="outline">
          <Link href="/analyze">Try Again</Link>
        </Button>
      </div>
    )
  }

  const score = analysis?.overall_score ?? 0
  const scoreColor =
    score >= 80 ? "from-emerald-500 to-teal-500" :
    score >= 60 ? "from-amber-400 to-orange-500" :
    "from-red-500 to-rose-500"
  const scoreTextClass =
    score >= 80 ? "text-emerald-400" :
    score >= 60 ? "text-amber-400" :
    "text-red-400"
  const scoreLabel =
    score >= 80 ? "Great!" :
    score >= 60 ? "Needs Work" :
    "Poor"

  return (
    <div className="flex flex-col min-h-screen">
      <Header />

      <main id="main-content" className="flex-1 pt-20 pb-12">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto space-y-6">
            <div className="grid lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2 border border-border/50 bg-transparent overflow-hidden relative">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-emerald-500/5 to-transparent rounded-full blur-2xl" />
                <CardHeader>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <FileText className="h-4 w-4" />
                    <span>{resume?.original_filename} &middot; {resume?.file_type?.toUpperCase()} &middot; {Math.round((resume?.file_size_bytes || 0) / 1024)} KB</span>
                  </div>
                  <CardTitle className="text-2xl">ATS Compatibility Score</CardTitle>
                  <CardDescription>How well your resume performs against automated screening systems</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="relative h-4 rounded-full bg-muted overflow-hidden mb-8">
                    <div
                      className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${scoreColor} transition-all duration-1000 ease-out shadow-lg`}
                      style={{ width: `${score}%` }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-gradient opacity-50" />
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                    {analysis?.category_scores && Object.entries(analysis.category_scores).map(([key, val]: any) => (
                      <ScoreGauge key={key} value={val} label={key} />
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="border border-border/50 bg-transparent overflow-hidden relative flex flex-col">
                <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-cyan-500/5 to-transparent rounded-full blur-2xl" />
                <CardHeader>
                  <CardTitle className="text-lg">Overall Score</CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col items-center justify-center pb-8">
                  <div className="relative mb-4">
                    <div className={`w-36 h-36 rounded-full flex items-center justify-center bg-gradient-to-br ${scoreColor} shadow-xl glow-brand`}>
                      <span className="text-4xl font-extrabold text-white">{score}</span>
                    </div>
                    <div className="absolute -top-1 -right-1 w-10 h-10 rounded-full bg-card flex items-center justify-center shadow-lg border border-emerald-500/20">
                      <span className={`text-lg font-bold ${scoreTextClass}`}>
                        {scoreLabel === "Great!" ? "A" : scoreLabel === "Needs Work" ? "B" : "C"}
                      </span>
                    </div>
                  </div>
                  <Badge className={`text-sm px-4 py-1.5 bg-gradient-to-r ${scoreColor} text-white border-0`}>
                    <Award className="h-3.5 w-3.5 mr-1.5" />
                    {scoreLabel}
                  </Badge>
                  {analysis?.priority_fixes?.length > 0 && (
                    <p className="text-xs text-muted-foreground text-center mt-4">
                      {analysis.priority_fixes.length} priority fix(es) recommended
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="border border-border/50 bg-transparent">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-emerald-400" />
                  <CardTitle className="text-lg">Job Description</CardTitle>
                </div>
                <CardDescription>Paste a job description to match, rewrite, and generate a cover letter</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
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
                  className="min-h-[160px] bg-background/50"
                  value={jdText}
                  onChange={(e) => setJdText(e.target.value)}
                />
                <div className="flex flex-wrap gap-3">
                  <Button onClick={handleJDMatch} disabled={!jdText.trim() || jdLoading} className="bg-gradient-brand hover:opacity-90 text-white shadow-lg glow-brand">
                    {jdLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Matching...</> : <><Sparkles className="mr-2 h-4 w-4" /> Match Resume to JD</>}
                  </Button>
                  <Button onClick={handleRewrite} disabled={rewritesLoading} variant="outline" className="border-emerald-700/50 text-emerald-400 hover:bg-emerald-950/30">
                    {rewritesLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...</> : <><Lightbulb className="mr-2 h-4 w-4" /> Rewrite Suggestions</>}
                  </Button>
                  <Button onClick={handleCoverLetter} disabled={!jdText.trim() || clLoading} variant="outline" className="border-cyan-700/50 text-cyan-400 hover:bg-cyan-950/30">
                    {clLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...</> : <><FileText className="mr-2 h-4 w-4" /> Generate Cover Letter</>}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid grid-cols-5 bg-muted/80 p-1 rounded-xl">
                <TabsTrigger value="ats" className="rounded-lg data-[state=active]:bg-gradient-brand data-[state=active]:text-white">ATS Details</TabsTrigger>
                <TabsTrigger value="jd-match" className="rounded-lg data-[state=active]:bg-gradient-brand data-[state=active]:text-white">
                  JD Match {jdMatch ? <Badge className="ml-2 bg-white/20 text-white border-0">{jdMatch.match_score}%</Badge> : null}
                </TabsTrigger>
                <TabsTrigger value="rewrites" className="rounded-lg data-[state=active]:bg-gradient-brand data-[state=active]:text-white">
                  Rewrites {rewrites.length > 0 ? <Badge className="ml-2 bg-white/20 text-white border-0">{rewrites.length}</Badge> : null}
                </TabsTrigger>
                <TabsTrigger value="ai-tools" className="rounded-lg data-[state=active]:bg-gradient-brand data-[state=active]:text-white">
                  <Sparkles className="h-3.5 w-3.5 inline mr-1" /> AI Tools
                </TabsTrigger>
                <TabsTrigger value="cover-letter" className="rounded-lg data-[state=active]:bg-gradient-brand data-[state=active]:text-white">Cover Letter</TabsTrigger>
              </TabsList>

              <TabsContent value="ats" className="space-y-6 mt-6">
                <Card className="border border-border/50 bg-transparent">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5 text-emerald-400" />
                      Category Breakdown
                    </CardTitle>
                    <CardDescription>Detailed scoring by ATS compatibility factor</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {analysis?.category_feedback && Object.entries(analysis.category_feedback).map(([key, feedback]: any) => (
                      <div key={key} className="p-4 rounded-xl bg-muted/50 hover:bg-muted/80 transition-colors">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-semibold">{key}</span>
                          <span className={`text-sm font-bold px-2.5 py-0.5 rounded-full ${
                            analysis?.category_scores?.[key] >= 80 ? "bg-emerald-900/40 text-emerald-400" :
                            analysis?.category_scores?.[key] >= 60 ? "bg-amber-900/40 text-amber-400" :
                            "bg-red-900/40 text-red-400"
                          }`}>{analysis?.category_scores?.[key]}/100</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{feedback}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {resume?.ats_view_text && (
                  <Card className="border border-border/50 bg-transparent">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-emerald-400" />
                        &ldquo;ATS View&rdquo; of Your Resume
                      </CardTitle>
                      <CardDescription>This is how an ATS parser sees your resume — raw text with no formatting</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="bg-muted/50 p-4 rounded-xl border border-border/50">
                        <pre className="text-xs whitespace-pre-wrap font-mono max-h-[500px] overflow-y-auto leading-relaxed">
                          {resume.ats_view_text}
                        </pre>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="jd-match" className="space-y-6 mt-6">
                {jdMatch ? (
                  <>
                    <Card className="border border-border/50 bg-transparent overflow-hidden relative">
                      <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-emerald-500/5 to-transparent rounded-full blur-2xl" />
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <Target className="h-5 w-5 text-emerald-400" />
                            JD Match Score
                          </span>
                          <span className={`text-3xl font-extrabold ${
                            jdMatch.match_score >= 70 ? "text-emerald-400" :
                            jdMatch.match_score >= 50 ? "text-amber-400" :
                            "text-red-400"
                          }`}>{jdMatch.match_score}%</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="relative h-3 rounded-full bg-muted overflow-hidden">
                          <div className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${
                            jdMatch.match_score >= 70 ? "from-emerald-500 to-teal-500" :
                            jdMatch.match_score >= 50 ? "from-amber-400 to-orange-500" :
                            "from-red-500 to-rose-500"
                          } transition-all duration-1000`} style={{ width: `${jdMatch.match_score}%` }} />
                        </div>
                      </CardContent>
                    </Card>

                    <div className="grid md:grid-cols-2 gap-6">
                      {jdMatch.matched_keywords?.length > 0 && (
                        <Card className="border-0 bg-gradient-to-br from-emerald-950/30 to-teal-950/20">
                          <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-emerald-400">
                              <CheckCircle2 className="h-5 w-5" />
                              Matched ({jdMatch.matched_keywords.length})
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="flex flex-wrap gap-2">
                              {jdMatch.matched_keywords.map((k: any, i: number) => (
                                <Badge key={i} className="bg-emerald-900/40 text-emerald-400 border-0 hover:bg-emerald-900/60">{k.skill}</Badge>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {jdMatch.hard_requirements?.length > 0 && (
                        <Card className="border-0 bg-gradient-to-br from-red-950/30 to-rose-950/20">
                          <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-red-400">
                              <XCircle className="h-5 w-5" />
                              Missing Hard Requirements ({jdMatch.hard_requirements.length})
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="flex flex-wrap gap-2">
                              {jdMatch.hard_requirements.map((r: any, i: number) => (
                                <Badge key={i} className="bg-red-900/40 text-red-400 border-0">{r.skill}</Badge>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </div>

                    {jdMatch.missing_keywords?.filter((k: any) => k.status !== "required")?.length > 0 && (
                      <Card className="border-0 bg-gradient-to-br from-amber-950/30 to-yellow-950/20">
                        <CardHeader className="pb-3">
                          <CardTitle className="flex items-center gap-2 text-amber-400">
                            <AlertTriangle className="h-5 w-5" />
                            Nice-to-Have (Not on Resume)
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="flex flex-wrap gap-2">
                            {jdMatch.missing_keywords.filter((k: any) => k.status !== "required").map((k: any, i: number) => (
                              <Badge key={i} className="bg-amber-900/40 text-amber-400 border-0">{k.skill}</Badge>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {jdMatch.semantic_gaps?.length > 0 && (
                      <Card className="border border-border/50 bg-transparent">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="h-5 w-5 text-emerald-400" />
                            Semantic Gaps
                          </CardTitle>
                          <CardDescription>Your resume mentions these concepts differently than the JD</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {jdMatch.semantic_gaps.map((gap: any, i: number) => (
                            <div key={i} className="p-4 rounded-xl bg-muted/50 border border-border/50">
                              <p className="font-semibold text-sm">JD says: <span className="text-emerald-400">{gap.jd_term}</span></p>
                              <p className="text-sm text-muted-foreground mt-1">{gap.suggestion}</p>
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    )}

                    {jdMatch.over_indexed?.length > 0 && (
                      <Card className="border border-border/50 bg-transparent">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-amber-400" />
                            Over-Indexed Content
                          </CardTitle>
                          <CardDescription>These items on your resume aren&apos;t mentioned in the JD</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <ul className="space-y-3">
                            {jdMatch.over_indexed.map((item: any, i: number) => (
                              <li key={i} className="text-sm p-3 rounded-xl bg-muted/50 border border-border/50 flex items-start gap-3">
                                <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                                <span><strong>{item.item}</strong> ({item.type}) &mdash; <span className="text-muted-foreground">{item.suggestion}</span></span>
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    )}
                  </>
                ) : (
                  <Card className="border border-border/50 bg-transparent">
                    <CardContent className="py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <Target className="h-10 w-10 text-muted-foreground/40" />
                        <p className="text-muted-foreground">Paste a job description above and click &ldquo;Match Resume to JD&rdquo;</p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="rewrites" className="space-y-4 mt-6">
                {rewrites.length > 0 ? (
                  <>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">{rewrites.length} suggestion(s)</p>
                      <Button variant="ghost" size="sm" onClick={handleRewrite} className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/30">
                        <RefreshCw className="mr-2 h-4 w-4" /> Regenerate
                      </Button>
                    </div>
                    {rewrites.map((s: any, i: number) => (
                      <Card key={i} className="border border-border/50 bg-transparent overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-emerald-500 to-cyan-500" />
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-semibold">{s.section}</CardTitle>
                            <Badge className={`border-0 ${
                              s.type === "cliche" || s.type === "filler" ? "bg-amber-900/40 text-amber-400" :
                              s.type === "rewrite" ? "bg-emerald-900/40 text-emerald-400" :
                              "bg-muted text-muted-foreground"
                            }`}>{s.type}</Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div>
                            <p className="text-xs text-muted-foreground mb-1.5 font-medium">Original:</p>
                            <div className="bg-muted/50 p-3 rounded-lg text-sm border border-border/50">{s.original}</div>
                          </div>
                          {s.suggestion && (
                            <div>
                              <p className="text-xs text-muted-foreground mb-1.5 font-medium">Suggestion:</p>
                              <div className="bg-gradient-to-r from-emerald-950/30 to-cyan-950/30 p-3 rounded-lg text-sm border border-emerald-800/30">{s.suggestion}</div>
                            </div>
                          )}
                          {s.explanation && (
                            <p className="text-xs text-muted-foreground mt-1">{s.explanation}</p>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </>
                ) : (
                  <Card className="border border-border/50 bg-transparent">
                    <CardContent className="py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <Lightbulb className="h-10 w-10 text-muted-foreground/40" />
                        <p className="text-muted-foreground">Click &ldquo;Rewrite Suggestions&rdquo; above to get improvements</p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="ai-tools">
                <AIResumeTools resumeId={resumeId} jdText={jdText} />
              </TabsContent>

              <TabsContent value="cover-letter" className="mt-6">
                {coverLetter ? (
                  <Card className="border border-border/50 bg-transparent overflow-hidden">
                    <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-emerald-500/5 to-transparent rounded-full blur-2xl" />
                    <CardHeader>
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            <FileText className="h-5 w-5 text-emerald-400" />
                            Generated Cover Letter
                          </CardTitle>
                          <CardDescription>Tone: {clTone} &middot; Length: {clLength}</CardDescription>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          <Select
                            options={[
                              { value: "formal", label: "Formal" },
                              { value: "conversational", label: "Conversational" },
                              { value: "enthusiastic", label: "Enthusiastic" },
                              { value: "executive", label: "Executive" },
                            ]}
                            value={clTone}
                            onChange={(e) => { setClTone(e.target.value); handleCoverLetter() }}
                          />
                          <Select
                            options={[
                              { value: "short", label: "Short" },
                              { value: "medium", label: "Medium" },
                              { value: "long", label: "Long" },
                            ]}
                            value={clLength}
                            onChange={(e) => { setClLength(e.target.value); handleCoverLetter() }}
                          />
                          <Button variant="outline" size="icon" onClick={() => copyToClipboard(coverLetter)} className="shrink-0">
                            {clCopied ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="bg-card/50 p-6 rounded-xl border border-border/50 whitespace-pre-wrap font-sans text-sm leading-relaxed shadow-sm">
                        {coverLetter}
                      </div>
                      <div className="mt-4 flex gap-2">
                        <Button onClick={handleCoverLetter} className="bg-gradient-brand hover:opacity-90 text-white shadow-lg glow-brand">
                          <RefreshCw className="mr-2 h-4 w-4" /> Regenerate
                        </Button>
                        <Button variant="outline" onClick={() => copyToClipboard(coverLetter)}>
                          <Copy className="mr-2 h-4 w-4" /> Copy
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="border border-border/50 bg-transparent">
                    <CardContent className="py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <FileText className="h-10 w-10 text-muted-foreground/40" />
                        <p className="text-muted-foreground">Paste a job description, select tone & length, then click &ldquo;Generate Cover Letter&rdquo;</p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
