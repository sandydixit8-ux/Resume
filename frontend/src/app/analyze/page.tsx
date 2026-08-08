"use client"

import { useState, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { uploadResume, pasteResume } from "@/lib/api"
import { Upload, FileText, Loader2, Sparkles, CheckCircle2, AlertCircle } from "lucide-react"
import Header from "@/components/header"
import Footer from "@/components/footer"

export default function AnalyzePage() {
  const router = useRouter()
  const [uploading, setUploading] = useState(false)
  const [pasting, setPasting] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [pasteText, setPasteText] = useState("")
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = useCallback(async (file: File) => {
    setError(null)
    setUploading(true)
    try {
      const result = await uploadResume(file)
      router.push(`/results/${result.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setUploading(false)
    }
  }, [router])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const files = e.dataTransfer.files
    if (files.length > 0) handleFileUpload(files[0])
  }, [handleFileUpload])

  const handlePaste = async () => {
    if (!pasteText.trim()) return
    setError(null)
    setPasting(true)
    try {
      const result = await pasteResume(pasteText)
      router.push(`/results/${result.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Paste failed")
    } finally {
      setPasting(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header />

      <main id="main-content" className="flex-1 pt-20">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="text-center mb-10 animate-slide-up mt-8">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 text-sm font-medium text-emerald-300 mb-4">
              <Sparkles className="h-3.5 w-3.5" />
              Resume Analyzer
            </div>
            <h1 className="text-3xl md:text-5xl font-bold">Analyze Your Resume</h1>
            <p className="mt-3 text-muted-foreground text-lg max-w-lg mx-auto">
              Upload a file or paste your resume text to get started
            </p>
          </div>

          {error && (
            <div role="alert" className="mb-6 p-4 bg-red-950/30 border border-red-800/50 rounded-xl flex items-start gap-3 animate-slide-up">
              <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
              <span className="text-sm text-red-400">{error}</span>
            </div>
          )}

          <div className="grid gap-8">
            <Card className="border border-border/50 bg-transparent overflow-hidden relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-emerald-500/5 to-transparent rounded-full blur-2xl" />
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5 text-emerald-400" />
                  Upload File
                </CardTitle>
                <CardDescription>PDF, DOCX, or TXT supported</CardDescription>
              </CardHeader>
              <CardContent>
                <div
                  role="button"
                  tabIndex={0}
                  aria-label="Upload resume file. PDF, DOCX, or TXT supported. Click or press Enter to browse."
                  className={`relative rounded-xl border-2 border-dashed p-16 text-center transition-all duration-300 cursor-pointer overflow-hidden ${
                    dragOver
                      ? "border-emerald-500 bg-emerald-950/30 scale-[1.02]"
                      : "border-border hover:border-emerald-500/50 hover:bg-emerald-950/20 focus-visible:border-emerald-500 focus-visible:outline-none"
                  }`}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      fileInputRef.current?.click()
                    }
                  }}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx,.doc,.txt"
                    className="hidden"
                    onChange={(e) => { if (e.target.files?.[0]) handleFileUpload(e.target.files[0]) }}
                  />
                  {uploading ? (
                    <div className="flex flex-col items-center gap-3">
                      <div className="relative">
                        <div className="h-12 w-12 rounded-full border-4 border-emerald-800 border-t-emerald-500 animate-spin" />
                      </div>
                      <p className="font-medium">Uploading and parsing...</p>
                      <p className="text-sm text-muted-foreground">Extracting content for ATS analysis</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                      <div className={`p-4 rounded-2xl transition-all duration-300 ${dragOver ? "bg-emerald-900/40 scale-110" : "bg-muted"}`}>
                        <Upload className={`h-8 w-8 transition-colors duration-300 ${dragOver ? "text-emerald-400" : "text-muted-foreground"}`} />
                      </div>
                      <p className="font-semibold text-lg">
                        {dragOver ? "Drop your resume here" : "Drop your resume here or click to browse"}
                      </p>
                      <p className="text-sm text-muted-foreground">PDF, DOCX, or plain text &mdash; max 10 MB</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="flex items-center gap-4">
              <Separator className="flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
              <span className="text-sm font-medium text-muted-foreground bg-gradient-to-r from-emerald-600/20 via-cyan-500/20 to-emerald-600/20 px-4 py-1 rounded-full">OR</span>
              <Separator className="flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
            </div>

            <Card className="border border-border/50 bg-transparent overflow-hidden relative">
              <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-cyan-500/5 to-transparent rounded-full blur-2xl" />
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-cyan-400" />
                  Paste Resume Text
                </CardTitle>
                <CardDescription>Copy and paste your resume content directly</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  aria-label="Paste your resume text"
                  placeholder="Paste your full resume text here&#10;&#10;Example:&#10;John Doe&#10;john@example.com&#10;&#10;SKILLS&#10;Python, JavaScript, React&#10;&#10;EXPERIENCE&#10;Senior Developer at Acme Corp (2020-Present)&#10;- Led development of customer-facing web apps&#10;- Improved API response times by 40%"
                  className="min-h-[280px] font-mono text-sm bg-background/50 border-border/50 focus:border-emerald-500/50 transition-colors"
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                />
                <Button
                  onClick={handlePaste}
                  disabled={!pasteText.trim() || pasting}
                  className="w-full bg-gradient-brand hover:opacity-90 text-white shadow-lg glow-brand disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
                >
                  {pasting ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analyzing...</>
                  ) : (
                    <><Sparkles className="mr-2 h-4 w-4" /> Analyze Resume</>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="mt-8 mb-12 p-5 rounded-xl bg-gradient-to-r from-emerald-950/20 to-cyan-950/20 border border-emerald-800/30 flex items-start gap-3 text-sm">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Privacy First:</span>{" "}
              <span className="text-muted-foreground">Your resume text is processed for analysis only. We do not store your data longer than necessary.</span>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
