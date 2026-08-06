"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Select } from "@/components/ui/select"
import Header from "@/components/header"
import Footer from "@/components/footer"
import { FileText, Loader2, Sparkles, Copy, CheckCircle2, RefreshCw } from "lucide-react"
import { generateCoverLetter } from "@/lib/api"

export default function CoverLetterPage() {
  const [resumeId, setResumeId] = useState("")
  const [jdText, setJdText] = useState("")
  const [jdTitle, setJdTitle] = useState("")
  const [company, setCompany] = useState("")
  const [tone, setTone] = useState("formal")
  const [length, setLength] = useState("medium")
  const [content, setContent] = useState("")
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  async function handleGenerate() {
    if (!jdText.trim() || !resumeId.trim()) return
    setLoading(true); setContent("")
    try {
      const r = await generateCoverLetter({ resume_id: Number(resumeId), jd_text: jdText, jd_title: jdTitle, company_name: company, tone, length })
      setContent(r.content)
    } catch { }
    finally { setLoading(false) }
  }

  function copy() {
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main id="main-content" className="flex-1 pt-24 pb-12">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 text-sm font-medium text-emerald-300 mb-4">
              <FileText className="h-3.5 w-3.5" />
              Cover Letter Generator
            </div>
            <h1 className="text-3xl md:text-5xl font-bold">Generate Cover Letters</h1>
            <p className="mt-3 text-muted-foreground text-lg max-w-2xl mx-auto">
              Create personalized, ATS-friendly cover letters tailored to any role
            </p>
          </div>

          <Card className="border border-border/50 bg-transparent mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-emerald-400" />
                Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Resume ID</label>
                <input className="flex h-9 w-full rounded-md border border-input bg-background/50 px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50" placeholder="Enter resume ID" value={resumeId} onChange={(e) => setResumeId(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Job Title</label>
                  <input className="flex h-9 w-full rounded-md border border-input bg-background/50 px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50" placeholder="e.g. Software Engineer" value={jdTitle} onChange={(e) => setJdTitle(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Company</label>
                  <input className="flex h-9 w-full rounded-md border border-input bg-background/50 px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50" placeholder="e.g. Acme Corp" value={company} onChange={(e) => setCompany(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="tone" className="text-sm font-medium mb-1 block">Tone</label>
                  <Select id="tone" options={[{ value: "formal", label: "Formal" }, { value: "conversational", label: "Conversational" }, { value: "enthusiastic", label: "Enthusiastic" }, { value: "executive", label: "Executive" }]} value={tone} onChange={(e) => setTone(e.target.value)} />
                </div>
                <div>
                  <label htmlFor="length" className="text-sm font-medium mb-1 block">Length</label>
                  <Select id="length" options={[{ value: "short", label: "Short" }, { value: "medium", label: "Medium" }, { value: "long", label: "Long" }]} value={length} onChange={(e) => setLength(e.target.value)} />
                </div>
              </div>
              <Textarea placeholder="Paste the job description..." className="min-h-[160px] bg-background/50" value={jdText} onChange={(e) => setJdText(e.target.value)} />
              <Button onClick={handleGenerate} disabled={!jdText.trim() || !resumeId.trim() || loading} className="w-full bg-gradient-brand hover:opacity-90 text-white shadow-lg glow-brand">
                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...</> : <><Sparkles className="mr-2 h-4 w-4" /> Generate Cover Letter</>}
              </Button>
            </CardContent>
          </Card>

          {content && (
            <Card className="border border-border/50 bg-transparent overflow-hidden">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Your Cover Letter</CardTitle>
                  <Button variant="outline" size="sm" onClick={copy}>
                    {copied ? <><CheckCircle2 className="mr-2 h-4 w-4 text-emerald-500" /> Copied</> : <><Copy className="mr-2 h-4 w-4" /> Copy</>}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="bg-card/50 p-6 rounded-xl border border-border/50 whitespace-pre-wrap text-sm leading-relaxed">
                  {content}
                </div>
                <div className="mt-4 flex gap-2">
                  <Button onClick={handleGenerate} className="bg-gradient-brand hover:opacity-90 text-white glow-brand">
                    <RefreshCw className="mr-2 h-4 w-4" /> Regenerate
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}
