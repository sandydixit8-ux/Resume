"use client"

import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Header from "@/components/header"
import Footer from "@/components/footer"
import {
  Lightbulb, Sparkles, Mic, BookOpen, ListChecks, Loader2,
  Brain, Target, ChevronDown, ChevronUp, RefreshCw, Upload, FileText,
  X, CheckCircle2, FileUp,
} from "lucide-react"
import { getInterviewQuestions, getInterviewQuestionsFromText, uploadResume } from "@/lib/api"

const categoryConfig: Record<string, { icon: any; label: string; color: string }> = {
  resume: { icon: BookOpen, label: "Resume-Based", color: "text-emerald-400" },
  jd: { icon: Target, label: "JD-Focused", color: "text-cyan-400" },
  behavioral: { icon: Mic, label: "Behavioral", color: "text-amber-400" },
  technical: { icon: Brain, label: "Technical", color: "text-violet-400" },
  leadership: { icon: ListChecks, label: "Leadership", color: "text-rose-400" },
}

export default function InterviewPage() {
  const [mode, setMode] = useState<"text" | "upload" | "id">("text")
  const [resumeId, setResumeId] = useState("")
  const [resumeText, setResumeText] = useState("")
  const [uploadedId, setUploadedId] = useState<number | null>(null)
  const [uploadedName, setUploadedName] = useState("")
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [jdText, setJdText] = useState("")
  const [questions, setQuestions] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState("all")

  async function handleFile(file: File) {
    const ext = (file.name.split(".").pop() || "").toLowerCase()
    if (!["pdf", "docx", "txt"].includes(ext)) {
      setUploadError("Unsupported file type. Please upload a PDF, DOCX, or TXT file.")
      return
    }
    setUploading(true); setUploadError(null); setQuestions([])
    try {
      const r = await uploadResume(file)
      setUploadedId(r.id)
      setUploadedName(file.name)
    } catch (err: any) {
      setUploadError(err.message || "Upload failed")
      setUploadedId(null); setUploadedName("")
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  async function handleGenerate() {
    const hasText = resumeText.trim().length > 0
    const hasId = resumeId.trim().length > 0
    if (mode === "text" && !hasText) return
    if (mode === "upload" && !uploadedId) return
    if (mode === "id" && !hasId) return
    setLoading(true); setError(null); setQuestions([])
    try {
      const r = mode === "id"
        ? await getInterviewQuestions(Number(resumeId), jdText || undefined)
        : mode === "upload" && uploadedId
          ? await getInterviewQuestions(uploadedId, jdText || undefined)
          : await getInterviewQuestionsFromText(resumeText, jdText || undefined)
      setQuestions(r.questions || [])
    } catch (err: any) { setError(err.message) }
    finally { setLoading(false) }
  }

  const categories = [...new Set(questions.map(q => q.category))]
  const filtered = activeTab === "all" ? questions : questions.filter(q => q.category === activeTab)

  const canGenerate = mode === "text"
    ? resumeText.trim().length > 0
    : mode === "upload"
      ? !!uploadedId
      : resumeId.trim().length > 0

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main id="main-content" className="flex-1 pt-24 pb-12">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 text-sm font-medium text-emerald-300 mb-4">
              <Lightbulb className="h-3.5 w-3.5" />
              Interview Prep
            </div>
            <h1 className="text-3xl md:text-5xl font-bold">Interview Questions</h1>
            <p className="mt-3 text-muted-foreground text-lg max-w-2xl mx-auto">
              Generate tailored interview questions based on your resume and job description
            </p>
          </div>

          <Card className="border border-border/50 bg-transparent mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-emerald-400" />
                Generate Questions
              </CardTitle>
              <CardDescription>Paste your resume and optionally a job description to get tailored interview questions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Your Resume</label>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setMode("text")}
                    className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                      mode === "text" ? "border-emerald-500/50 bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 text-emerald-300" : "border-border/50 text-muted-foreground hover:border-border"
                    }`}
                  >
                    <FileText className="h-3.5 w-3.5" /> Paste Text
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("upload")}
                    className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                      mode === "upload" ? "border-emerald-500/50 bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 text-emerald-300" : "border-border/50 text-muted-foreground hover:border-border"
                    }`}
                  >
                    <Upload className="h-3.5 w-3.5" /> Upload File
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("id")}
                    className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                      mode === "id" ? "border-emerald-500/50 bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 text-emerald-300" : "border-border/50 text-muted-foreground hover:border-border"
                    }`}
                  >
                    <BookOpen className="h-3.5 w-3.5" /> Resume ID
                  </button>
                </div>

                {mode === "text" && (
                  <>
                    <Textarea
                      placeholder="Paste your resume text here... e.g. Senior Software Engineer with 6 years of experience..."
                      className="min-h-[160px] bg-background/50 font-mono text-xs"
                      value={resumeText}
                      onChange={(e) => setResumeText(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground mt-1">Works standalone — no resume ID needed</p>
                  </>
                )}

                {mode === "upload" && (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.docx,.txt"
                      className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
                    />
                    {uploadedId ? (
                      <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-500/40 bg-emerald-500/5 px-4 py-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-emerald-300 truncate">{uploadedName}</p>
                            <p className="text-xs text-muted-foreground">Resume ID: {uploadedId} — ready to generate</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => { setUploadedId(null); setUploadedName("") }}
                          className="text-muted-foreground hover:text-red-400 shrink-0"
                          aria-label="Remove uploaded resume"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f) }}
                        className={`w-full rounded-lg border-2 border-dashed px-4 py-8 flex flex-col items-center justify-center gap-2 text-sm transition-colors ${
                          dragOver ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-300" : "border-border/60 text-muted-foreground hover:border-emerald-500/40 hover:text-emerald-300"
                        }`}
                      >
                        {uploading ? (
                          <>
                            <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
                            <span>Uploading and parsing resume...</span>
                          </>
                        ) : (
                          <>
                            <FileUp className="h-6 w-6" />
                            <span className="font-medium">Click to upload or drag &amp; drop</span>
                            <span className="text-xs">PDF, DOCX, or TXT (max 10 MB)</span>
                          </>
                        )}
                      </button>
                    )}
                    {uploadError && (
                      <p className="text-xs text-red-400 mt-2">{uploadError}</p>
                    )}
                  </>
                )}

                {mode === "id" && (
                  <div>
                    <input
                      className="flex h-9 w-full rounded-md border border-input bg-background/50 px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                      placeholder="Enter resume ID from analysis"
                      value={resumeId}
                      onChange={(e) => setResumeId(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground mt-1">Don&apos;t have one? <a href="/analyze" className="text-emerald-400 hover:text-emerald-300">Analyze a resume first</a></p>
                  </div>
                )}
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Job Description (optional)</label>
                <Textarea
                  placeholder="Paste a job description for role-specific questions..."
                  className="min-h-[120px] bg-background/50"
                  value={jdText}
                  onChange={(e) => setJdText(e.target.value)}
                />
              </div>
              <Button onClick={handleGenerate} disabled={loading || !canGenerate} className="w-full bg-gradient-brand hover:opacity-90 text-white shadow-lg glow-brand">
                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...</> : <><Sparkles className="mr-2 h-4 w-4" /> Generate Interview Questions</>}
              </Button>
            </CardContent>
          </Card>

          {error && (
            <div className="mb-6 p-4 bg-red-950/30 border border-red-800/50 rounded-xl text-sm text-red-400">{error}</div>
          )}

          {questions.length > 0 && (
            <>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-muted-foreground">{questions.length} questions generated</p>
                <Button variant="ghost" size="sm" onClick={handleGenerate} className="text-emerald-400 hover:text-emerald-300">
                  <RefreshCw className="mr-2 h-4 w-4" /> Regenerate
                </Button>
              </div>

              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="bg-muted/80 p-1 rounded-xl mb-6 flex-wrap h-auto">
                  <TabsTrigger value="all" className="rounded-lg data-[state=active]:bg-gradient-brand data-[state=active]:text-white">
                    All ({questions.length})
                  </TabsTrigger>
                  {categories.map(cat => {
                    const cfg = categoryConfig[cat] || { icon: Lightbulb, label: cat, color: "text-muted-foreground" }
                    const count = questions.filter(q => q.category === cat).length
                    return (
                      <TabsTrigger key={cat} value={cat} className="rounded-lg data-[state=active]:bg-gradient-brand data-[state=active]:text-white">
                        <cfg.icon className={`h-3.5 w-3.5 mr-1.5 ${cfg.color}`} />
                        {cfg.label} ({count})
                      </TabsTrigger>
                    )
                  })}
                </TabsList>

                <TabsContent value={activeTab} className="space-y-3">
                  {filtered.map((q, i) => {
                    const cfg = categoryConfig[q.category] || { icon: Lightbulb, label: q.category, color: "text-muted-foreground" }
                    const isOpen = expanded === i
                    return (
                      <Card
                        key={i}
                        className={`border border-border/50 bg-transparent overflow-hidden cursor-pointer transition-all duration-300 hover:border-emerald-500/30 ${isOpen ? "border-emerald-500/40" : ""}`}
                        onClick={() => setExpanded(isOpen ? null : i)}
                      >
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3">
                              <div className={`w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5`}>
                                <cfg.icon className={`h-4 w-4 ${cfg.color}`} />
                              </div>
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge className={`border-0 text-xs ${
                                    q.category === "resume" ? "bg-emerald-900/40 text-emerald-400" :
                                    q.category === "jd" ? "bg-cyan-900/40 text-cyan-400" :
                                    q.category === "behavioral" ? "bg-amber-900/40 text-amber-400" :
                                    q.category === "technical" ? "bg-violet-900/40 text-violet-400" :
                                    "bg-rose-900/40 text-rose-400"
                                  }`}>{cfg.label}</Badge>
                                  <Badge className="bg-muted text-muted-foreground border-0 text-xs">{q.type}</Badge>
                                </div>
                                <p className="font-medium text-sm leading-relaxed">{q.question}</p>
                              </div>
                            </div>
                            <div className="text-muted-foreground shrink-0 mt-1">
                              {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </div>
                          </div>
                        </CardHeader>
                        {isOpen && q.context && (
                          <CardContent className="pt-0 pb-4">
                            <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
                              <p className="text-xs text-muted-foreground font-medium mb-1">Context:</p>
                              <p className="text-sm text-muted-foreground">{q.context}</p>
                            </div>
                          </CardContent>
                        )}
                      </Card>
                    )
                  })}
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}
