"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select } from "@/components/ui/select"
import {
  Loader2,
  Sparkles,
  Copy,
  CheckCircle2,
  Download,
  Globe,
  Briefcase,
} from "lucide-react"
import {
  aiAchievements,
  aiSummary,
  aiSkills,
  aiImprove,
  aiLinkedin,
  getCountries,
  exportResume,
} from "@/lib/api"

type Props = {
  resumeId: number
  jdText: string
}

const EXPORT_FORMATS = [
  { value: "pdf", label: "PDF" },
  { value: "docx", label: "DOCX" },
  { value: "html", label: "HTML" },
  { value: "md", label: "Markdown" },
  { value: "json", label: "JSON Resume" },
  { value: "tex", label: "LaTeX" },
  { value: "europass", label: "Europass XML" },
]

function copyText(text: string) {
  navigator.clipboard?.writeText(text)
}

export default function AIResumeTools({ resumeId, jdText }: Props) {
  const [busy, setBusy] = useState<string | null>(null)
  const [summary, setSummary] = useState<any>(null)
  const [achievements, setAchievements] = useState<any>(null)
  const [skills, setSkills] = useState<any>(null)
  const [rewrites, setRewrites] = useState<any>(null)
  const [linkedin, setLinkedin] = useState<any>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const [countries, setCountries] = useState<{ code: string; name: string }[]>([])
  const [country, setCountry] = useState("us")
  const [exportBusy, setExportBusy] = useState(false)

  const jd = jdText.trim() ? jdText : undefined

  async function run(key: string, fn: () => Promise<any>, setter: (v: any) => void) {
    setBusy(key)
    try {
      setter(await fn())
    } finally {
      setBusy(null)
    }
  }

  function copy(label: string, text: string) {
    copyText(text)
    setCopied(label)
    setTimeout(() => setCopied(null), 1500)
  }

  async function loadCountries() {
    if (countries.length) return
    try {
      const r = await getCountries()
      setCountries(r.countries || [])
    } catch {}
  }

  async function handleExport(format: string) {
    setExportBusy(true)
    try {
      const { blob, filename } = await exportResume({
        format,
        country,
        template: "professional",
        resume_id: resumeId,
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      alert(e.message || "Export failed")
    } finally {
      setExportBusy(false)
    }
  }

  return (
    <div className="space-y-6 mt-6">
      <Card className="border border-border/50 bg-transparent">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-emerald-400" />
            AI Resume Tools
          </CardTitle>
          <CardDescription>Optimize your resume with AI assistance. Results use your job description context when provided above.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Summary */}
          <div className="p-4 rounded-xl bg-muted/40 border border-border/50">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold">Professional Summary Optimizer</p>
                <p className="text-xs text-muted-foreground">Rewrite your summary to be keyword-rich and impact-driven.</p>
              </div>
              <Button size="sm" onClick={() => run("summary", () => aiSummary(resumeId, jd), setSummary)} disabled={busy === "summary"} className="bg-gradient-brand hover:opacity-90 text-white shadow-lg glow-brand">
                {busy === "summary" ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Working...</> : <><Sparkles className="mr-2 h-4 w-4" /> Optimize Summary</>}
              </Button>
            </div>
            {summary && (
              <div className="mt-3 space-y-2">
                <div className="bg-muted/50 p-3 rounded-lg border border-border/50 text-sm">
                  <p className="text-xs text-muted-foreground mb-1 font-medium">Optimized:</p>
                  {summary.optimized}
                </div>
                {summary.explanation && <p className="text-xs text-muted-foreground">{summary.explanation}</p>}
                <Button size="sm" variant="outline" onClick={() => copy("summary", summary.optimized)}>
                  {copied === "summary" ? <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-500" /> : <Copy className="mr-2 h-4 w-4" />} Copy
                </Button>
              </div>
            )}
          </div>

          {/* Achievements */}
          <div className="p-4 rounded-xl bg-muted/40 border border-border/50">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold">AI Achievement Writer</p>
                <p className="text-xs text-muted-foreground">Turn &ldquo;responsible for&rdquo; statements into quantified achievements.</p>
              </div>
              <Button size="sm" onClick={() => run("ach", () => aiAchievements(resumeId, jd), setAchievements)} disabled={busy === "ach"} className="bg-gradient-brand hover:opacity-90 text-white shadow-lg glow-brand">
                {busy === "ach" ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Working...</> : <><Sparkles className="mr-2 h-4 w-4" /> Write Achievements</>}
              </Button>
            </div>
            {achievements && achievements.achievements?.length > 0 && (
              <div className="mt-3 space-y-2">
                {achievements.achievements.map((a: any, i: number) => (
                  <div key={i} className="bg-muted/50 p-3 rounded-lg border border-border/50 text-sm">
                    <p className="text-xs text-emerald-400 font-semibold mb-1">{a.section}</p>
                    <p>{a.achievement}</p>
                    <p className="text-xs text-muted-foreground mt-1">{a.impact}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Skills */}
          <div className="p-4 rounded-xl bg-muted/40 border border-border/50">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold">AI Skills Engine</p>
                <p className="text-xs text-muted-foreground">Categorized skill suggestions and missing keywords.</p>
              </div>
              <Button size="sm" onClick={() => run("skills", () => aiSkills(resumeId, jd), setSkills)} disabled={busy === "skills"} className="bg-gradient-brand hover:opacity-90 text-white shadow-lg glow-brand">
                {busy === "skills" ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Working...</> : <><Sparkles className="mr-2 h-4 w-4" /> Suggest Skills</>}
              </Button>
            </div>
            {skills && (
              <div className="mt-3 space-y-3">
                {skills.categories && Object.entries(skills.categories).filter(([, v]: any) => v?.length).map(([cat, vals]: any) => (
                  <div key={cat}>
                    <p className="text-xs text-muted-foreground font-medium mb-1">{cat}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {vals.map((s: string, i: number) => <Badge key={i} className="bg-emerald-900/40 text-emerald-400 border-0">{s}</Badge>)}
                    </div>
                  </div>
                ))}
                {skills.missing?.length > 0 && (
                  <div>
                    <p className="text-xs text-amber-400 font-medium mb-1">Missing from JD:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {skills.missing.map((s: string, i: number) => <Badge key={i} className="bg-amber-900/40 text-amber-400 border-0">{s}</Badge>)}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Experience rewrite */}
          <div className="p-4 rounded-xl bg-muted/40 border border-border/50">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold">AI Experience Rewrite</p>
                <p className="text-xs text-muted-foreground">Rewrite your experience bullets to be action-first and ATS-friendly.</p>
              </div>
              <Button size="sm" onClick={() => run("imp", () => aiImprove(resumeId, jd), setRewrites)} disabled={busy === "imp"} className="bg-gradient-brand hover:opacity-90 text-white shadow-lg glow-brand">
                {busy === "imp" ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Working...</> : <><Sparkles className="mr-2 h-4 w-4" /> Rewrite Experience</>}
              </Button>
            </div>
            {rewrites && rewrites.rewrites?.length > 0 && (
              <div className="mt-3 space-y-2">
                {rewrites.rewrites.map((r: any, i: number) => (
                  <div key={i} className="bg-muted/50 p-3 rounded-lg border border-border/50 text-sm">
                    <p className="text-xs text-emerald-400 font-semibold mb-1">{r.section}</p>
                    <p className="text-xs text-muted-foreground">Before: <span className="line-through">{r.original}</span></p>
                    <p className="mt-1">After: <span className="text-emerald-400">{r.rewritten}</span></p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* LinkedIn */}
          <div className="p-4 rounded-xl bg-muted/40 border border-border/50">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold flex items-center gap-1.5"><Briefcase className="h-4 w-4 text-sky-400" /> LinkedIn Optimization</p>
                <p className="text-xs text-muted-foreground">Headline, about, skills and banner text optimized for recruiter search.</p>
              </div>
              <Button size="sm" onClick={() => run("li", () => aiLinkedin(resumeId, jd), setLinkedin)} disabled={busy === "li"} className="bg-gradient-brand hover:opacity-90 text-white shadow-lg glow-brand">
                {busy === "li" ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Working...</> : <><Sparkles className="mr-2 h-4 w-4" /> Generate LinkedIn Profile</>}
              </Button>
            </div>
            {linkedin && (
              <div className="mt-3 space-y-3 text-sm">
                <div className="bg-muted/50 p-3 rounded-lg border border-border/50">
                  <p className="text-xs text-muted-foreground mb-1 font-medium">Headline:</p>
                  {linkedin.headline}
                  <Button size="sm" variant="ghost" className="ml-2 h-6 px-2 text-xs" onClick={() => copy("li-head", linkedin.headline)}>
                    {copied === "li-head" ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                  </Button>
                </div>
                <div className="bg-muted/50 p-3 rounded-lg border border-border/50">
                  <p className="text-xs text-muted-foreground mb-1 font-medium">About:</p>
                  <div className="whitespace-pre-wrap">{linkedin.about}</div>
                  <Button size="sm" variant="ghost" className="mt-1 h-6 px-2 text-xs" onClick={() => copy("li-about", linkedin.about)}>
                    {copied === "li-about" ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />} Copy
                  </Button>
                </div>
                <div className="bg-muted/50 p-3 rounded-lg border border-border/50">
                  <p className="text-xs text-muted-foreground mb-1 font-medium">Skills:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {linkedin.skills?.map((s: string, i: number) => <Badge key={i} className="bg-sky-900/40 text-sky-400 border-0">{s}</Badge>)}
                  </div>
                </div>
                <div className="bg-muted/50 p-3 rounded-lg border border-border/50">
                  <p className="text-xs text-muted-foreground mb-1 font-medium">Banner Text: <span className="text-foreground">{linkedin.banner_text}</span></p>
                  <p className="text-xs text-muted-foreground mb-1 font-medium">Open to Work Title: <span className="text-foreground">{linkedin.open_to_work_title}</span></p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Export */}
      <Card className="border border-border/50 bg-transparent">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-emerald-400" />
            Export Resume
          </CardTitle>
          <CardDescription>Download in a country-optimized format.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-full sm:w-56" onClick={loadCountries}>
              <label className="text-sm font-medium mb-1 block">Country Rules</label>
              <Select
                options={countries.map((c) => ({ value: c.code, label: c.name }))}
                value={country}
                onChange={(e) => setCountry(e.target.value)}
              />
            </div>
            <Button variant="outline" size="sm" onClick={loadCountries}>
              <Globe className="mr-2 h-4 w-4" /> Load Countries
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {EXPORT_FORMATS.map((f) => (
              <Button key={f.value} variant="outline" size="sm" onClick={() => handleExport(f.value)} disabled={exportBusy} className="border-emerald-700/50 text-emerald-400 hover:bg-emerald-950/30">
                <Download className="mr-2 h-4 w-4" /> {f.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
