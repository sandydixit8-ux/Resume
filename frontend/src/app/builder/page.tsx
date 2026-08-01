"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import Header from "@/components/header"
import Footer from "@/components/footer"
import {
  FileText, Sparkles, Download, Eye, Palette, Plus, Trash2,
  Loader2, Printer, User, Briefcase, GraduationCap, FolderGit2, Wrench, AlignLeft,
} from "lucide-react"
import { getResume } from "@/lib/api"

type Experience = { title: string; company: string; dates: string; bullets: string[] }
type Education = { institution: string; degree: string; dates: string }
type Project = { name: string; description: string; link: string }

type ResumeData = {
  name: string
  title: string
  email: string
  phone: string
  location: string
  linkedin: string
  website: string
  summary: string
  skills: string
  experience: Experience[]
  education: Education[]
  projects: Project[]
}

const emptyData: ResumeData = {
  name: "", title: "", email: "", phone: "", location: "", linkedin: "", website: "",
  summary: "",
  skills: "",
  experience: [],
  education: [],
  projects: [],
}

const sampleData: ResumeData = {
  name: "Alex Morgan",
  title: "Senior Software Engineer",
  email: "alex.morgan@email.com",
  phone: "(555) 123-4567",
  location: "San Francisco, CA",
  linkedin: "linkedin.com/in/alexmorgan",
  website: "alexmorgan.dev",
  summary:
    "Results-driven software engineer with 7+ years of experience building scalable web applications. Proven track record of leading cross-functional teams, improving system performance by 40%, and shipping products used by millions of users.",
  skills: "JavaScript, TypeScript, React, Node.js, Python, SQL, AWS, Docker, Kubernetes, CI/CD",
  experience: [
    {
      title: "Senior Software Engineer", company: "TechCorp", dates: "Jan 2021 - Present",
      bullets: [
        "Led a team of 6 engineers to migrate a monolithic application to microservices, cutting deployment time by 60%",
        "Designed a real-time analytics pipeline processing 2M+ events daily with 99.9% uptime",
        "Mentored 4 junior developers and established code review practices adopted by 3 teams",
      ],
    },
    {
      title: "Software Engineer", company: "StartupX", dates: "Jun 2018 - Dec 2020",
      bullets: [
        "Built customer-facing React applications used by 500K+ monthly active users",
        "Reduced API response times from 800ms to 120ms through caching and query optimization",
        "Collaborated with product and design to ship 20+ major features",
      ],
    },
  ],
  education: [{ institution: "University of California, Berkeley", degree: "B.S. Computer Science", dates: "2014 - 2018" }],
  projects: [
    { name: "Open-Source Contributions", description: "Active contributor to React ecosystem libraries with 2K+ GitHub stars.", link: "github.com/alexmorgan" },
    { name: "DevMetrics Dashboard", description: "Self-hosted analytics dashboard for development teams; adopted by 15+ startups.", link: "devmetrics.io" },
  ],
}

function hasAnyData(d: ResumeData) {
  return Boolean(
    d.name || d.title || d.email || d.phone || d.location || d.linkedin || d.website ||
    d.summary || d.skills || d.experience.length > 0 || d.education.length > 0 || d.projects.length > 0
  )
}

function effectiveData(d: ResumeData): ResumeData {
  if (hasAnyData(d)) return d
  return {
    ...sampleData,
    experience: sampleData.experience.map((e) => ({ ...e, bullets: [...e.bullets] })),
    education: sampleData.education.map((e) => ({ ...e })),
    projects: sampleData.projects.map((p) => ({ ...p })),
  }
}

type Template = {
  id: string
  name: string
  desc: string
  accent: string
  font: string
  layout: "single" | "two"
  headerCenter: boolean
  headerBg: string
  headerText: string
  bodyText: string
  mutedText: string
  divider: string
  nameSize: string
  sectionLabel: string
}

const templates: Template[] = [
  {
    id: "modern", name: "Modern", desc: "Clean & contemporary", accent: "from-emerald-400 to-cyan-400",
    font: "Inter, sans-serif", layout: "two", headerCenter: false,
    headerBg: "#ffffff", headerText: "#0f172a", bodyText: "#334155", mutedText: "#64748b",
    divider: "2px solid #10b981", nameSize: "28px", sectionLabel: "UPPERCASE BOLD, BOTTOM BORDER",
  },
  {
    id: "professional", name: "Professional", desc: "Classic & polished", accent: "from-zinc-400 to-zinc-600",
    font: "Georgia, serif", layout: "single", headerCenter: false,
    headerBg: "#ffffff", headerText: "#111827", bodyText: "#374151", mutedText: "#6b7280",
    divider: "1px solid #9ca3af", nameSize: "30px", sectionLabel: "SMALL CAPS WITH RULE",
  },
  {
    id: "minimal", name: "Minimal", desc: "Distraction-free", accent: "from-zinc-400 to-zinc-500",
    font: "'Helvetica Neue', Arial, sans-serif", layout: "single", headerCenter: true,
    headerBg: "#ffffff", headerText: "#18181b", bodyText: "#3f3f46", mutedText: "#71717a",
    divider: "1px solid #e4e4e7", nameSize: "26px", sectionLabel: "SIMPLE UPPERCASE",
  },
  {
    id: "creative", name: "Creative", desc: "Stand out with style", accent: "from-rose-400 to-pink-500",
    font: "'Trebuchet MS', sans-serif", layout: "two", headerCenter: false,
    headerBg: "#fdf2f8", headerText: "#9d174d", bodyText: "#4c1d2e", mutedText: "#9d174d",
    divider: "3px solid #ec4899", nameSize: "30px", sectionLabel: "FILLED LABEL CHIP",
  },
  {
    id: "tech", name: "Technology", desc: "Modern tech-focused", accent: "from-emerald-400 to-cyan-400",
    font: "'SF Mono', Consolas, monospace", layout: "two", headerCenter: false,
    headerBg: "#0f172a", headerText: "#f8fafc", bodyText: "#e2e8f0", mutedText: "#94a3b8",
    divider: "2px solid #22d3ee", nameSize: "26px", sectionLabel: "CODE-STYLE HEADER",
  },
  {
    id: "executive", name: "Executive", desc: "Senior leadership", accent: "from-amber-400 to-orange-500",
    font: "Georgia, serif", layout: "single", headerCenter: true,
    headerBg: "#ffffff", headerText: "#1c1917", bodyText: "#44403c", mutedText: "#78716c",
    divider: "1px solid #d6a354", nameSize: "32px", sectionLabel: "CENTERED SMALL CAPS",
  },
]

const inputCls = "flex h-9 w-full rounded-md border border-input bg-background/50 px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
const labelCls = "text-xs font-medium text-muted-foreground mb-1 block"

function BuilderInner() {
  const searchParams = useSearchParams()
  const [selected, setSelected] = useState("modern")
  const [data, setData] = useState<ResumeData>(emptyData)
  const [loadingResume, setLoadingResume] = useState(false)

  useEffect(() => {
    const resumeId = searchParams.get("resume_id")
    if (resumeId) {
      setLoadingResume(true)
      getResume(Number(resumeId)).then((r) => {
        const p = r.parsed_json || {}
        setData({
          name: p.contact_info?.name || "",
          title: p.experience?.[0]?.title || "",
          email: p.contact_info?.email || "",
          phone: p.contact_info?.phone || "",
          location: p.contact_info?.location || "",
          linkedin: p.contact_info?.linkedin || "",
          website: "",
          summary: p.summary || "",
          skills: (p.skills || []).join(", "),
          experience: (p.experience || []).map((e: any) => ({ title: e.title || "", company: e.company || "", dates: e.dates || "", bullets: e.bullets || [] })),
          education: (p.education || []).map((e: any) => ({ institution: e.institution || "", degree: e.degree || "", dates: e.dates || "" })),
          projects: (p.projects || []).map((pr: any) => ({ name: pr.title || pr.name || "", description: (pr.bullets || []).join(" ") || "", link: "" })),
        })
      }).catch(() => {}).finally(() => setLoadingResume(false))
    }
  }, [searchParams])

  const tpl = templates.find((t) => t.id === selected) || templates[0]
  const d = effectiveData(data)
  const skillsList = d.skills.split(",").map((s) => s.trim()).filter(Boolean)

  function set<K extends keyof ResumeData>(key: K, value: ResumeData[K]) {
    setData((d) => ({ ...d, [key]: value }))
  }
  function setExp(i: number, key: keyof Experience, value: any) {
    setData((d) => ({ ...d, experience: d.experience.map((e, j) => (j === i ? { ...e, [key]: value } : e)) }))
  }
  function setBullet(expIdx: number, bIdx: number, value: string) {
    setData((d) => ({ ...d, experience: d.experience.map((e, j) => (j === expIdx ? { ...e, bullets: e.bullets.map((b, k) => (k === bIdx ? value : b)) } : e)) }))
  }
  function setEdu(i: number, key: keyof Education, value: any) {
    setData((d) => ({ ...d, education: d.education.map((e, j) => (j === i ? { ...e, [key]: value } : e)) }))
  }
  function setProj(i: number, key: keyof Project, value: any) {
    setData((d) => ({ ...d, projects: d.projects.map((e, j) => (j === i ? { ...e, [key]: value } : e)) }))
  }

  function buildHtml(): string {
    const d = effectiveData(data)
    const contact = [d.email, d.phone, d.location, d.linkedin, d.website].filter(Boolean)
    const skills = d.skills.split(",").map((s) => s.trim()).filter(Boolean)
    const expHtml = d.experience.map((e) => `
      <div class="item">
        <div class="row"><span class="strong">${esc(e.title)}</span><span class="muted">${esc(e.dates)}</span></div>
        <div class="muted">${esc(e.company)}</div>
        <ul>${e.bullets.filter(Boolean).map((b) => `<li>${esc(b)}</li>`).join("")}</ul>
      </div>`).join("")
    const eduHtml = d.education.map((e) => `
      <div class="item">
        <div class="row"><span class="strong">${esc(e.institution)}</span><span class="muted">${esc(e.dates)}</span></div>
        <div class="muted">${esc(e.degree)}</div>
      </div>`).join("")
    const projHtml = d.projects.map((p) => `
      <div class="item">
        <div class="row"><span class="strong">${esc(p.name)}</span>${p.link ? `<span class="muted">${esc(p.link)}</span>` : ""}</div>
        <div class="muted">${esc(p.description)}</div>
      </div>`).join("")
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(d.name || "Resume")} - Resume</title>
<style>
  body { font-family: ${tpl.font}; color: ${tpl.bodyText}; background: #fff; max-width: 800px; margin: 0 auto; padding: 40px; }
  .header { border-bottom: ${tpl.divider}; padding-bottom: 16px; margin-bottom: 20px; text-align: ${tpl.headerCenter ? "center" : "left"}; }
  h1 { font-size: ${tpl.nameSize}; color: ${tpl.headerText}; margin: 0 0 4px; }
  .role { font-size: 14px; margin: 0 0 8px; }
  .contact { font-size: 13px; color: ${tpl.mutedText}; }
  .section { margin: 18px 0 8px; font-size: 13px; letter-spacing: 1.5px; text-transform: uppercase; color: ${tpl.headerText}; font-weight: 700; border-bottom: ${tpl.divider}; padding-bottom: 4px; }
  .item { margin: 8px 0; font-size: 13px; }
  .row { display: flex; justify-content: space-between; }
  .strong { font-weight: 700; color: ${tpl.headerText}; }
  .muted { color: ${tpl.mutedText}; font-size: 12px; }
  ul { margin: 4px 0; padding-left: 18px; }
  .skills { display: flex; flex-wrap: wrap; gap: 6px; font-size: 12px; }
  .skill { border: 1px solid ${tpl.mutedText}; border-radius: 12px; padding: 2px 10px; }
</style></head><body>
  <div class="header">
    <h1>${esc(d.name || "Your Name")}</h1>
    ${d.title ? `<p class="role"><strong>${esc(d.title)}</strong></p>` : ""}
    ${contact.length ? `<div class="contact">${contact.map(esc).join(" | ")}</div>` : ""}
  </div>
  ${d.summary ? `<div class="section">Profile</div><div>${esc(d.summary)}</div>` : ""}
  ${skills.length ? `<div class="section">Skills</div><div class="skills">${skills.map((s) => `<span class="skill">${esc(s)}</span>`).join("")}</div>` : ""}
  ${d.experience.length ? `<div class="section">Experience</div>${expHtml}` : ""}
  ${d.education.length ? `<div class="section">Education</div>${eduHtml}` : ""}
  ${d.projects.length ? `<div class="section">Projects</div>${projHtml}` : ""}
</body></html>`
  }

  function downloadResume() {
    const blob = new Blob([buildHtml()], { type: "text/html" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${(effectiveData(data).name || "Resume").replace(/\s+/g, "_")}_resume.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  function printResume() {
    const win = window.open("", "_blank", "width=900,height=1100")
    if (!win) { alert("Please allow pop-ups to print your resume."); return }
    win.document.write(buildHtml())
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 300)
  }

  const preview = (
    <div style={{ fontFamily: tpl.font, color: tpl.bodyText, background: "#fff", minHeight: 600, borderRadius: 8 }}>
      <div style={{ borderBottom: tpl.divider, padding: "18px 20px", marginBottom: 0, textAlign: tpl.headerCenter ? "center" : "left", background: tpl.headerBg, color: tpl.headerText }}>
        <div style={{ fontSize: tpl.nameSize, fontWeight: 800, lineHeight: 1.1 }}>{d.name || "Your Name"}</div>
        {d.title && <div style={{ fontSize: 14, marginTop: 2, opacity: 0.9 }}>{d.title}</div>}
        <div style={{ fontSize: 12, color: tpl.mutedText, marginTop: 6, display: "flex", flexWrap: "wrap", gap: "4px 12px", justifyContent: tpl.headerCenter ? "center" : "flex-start" }}>
          {[d.email, d.phone, d.location, d.linkedin, d.website].filter(Boolean).map((c, i) => <span key={i}>{c}</span>)}
        </div>
      </div>
      <div style={{ padding: "18px 20px", display: tpl.layout === "two" ? "grid" : "block", gridTemplateColumns: "30% 1fr", gap: 20 }}>
        {tpl.layout === "two" && (
          <div>
            {skillsList.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div className="mb-1.5" style={{ fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", fontWeight: 700, color: tpl.headerText, borderBottom: tpl.divider, paddingBottom: 3 }}>Skills</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, fontSize: 11 }}>
                  {skillsList.map((s, i) => <span key={i} style={{ border: `1px solid ${tpl.mutedText}`, borderRadius: 10, padding: "1px 7px" }}>{s}</span>)}
                </div>
              </div>
            )}
            {d.education.length > 0 && (
              <div>
                <div className="mb-1.5" style={{ fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", fontWeight: 700, color: tpl.headerText, borderBottom: tpl.divider, paddingBottom: 3 }}>Education</div>
                {d.education.map((e, i) => (
                  <div key={i} style={{ fontSize: 11, marginBottom: 8 }}>
                    <div style={{ fontWeight: 700, color: tpl.headerText }}>{e.institution || "School"}</div>
                    <div>{e.degree}</div>
                    <div style={{ color: tpl.mutedText }}>{e.dates}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        <div>
          {d.summary && (
            <div style={{ marginBottom: 14 }}>
              <div className="mb-1.5"><span style={{ fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", fontWeight: 700, color: tpl.headerText, borderBottom: tpl.divider, paddingBottom: 3, display: "inline-block" }}>Profile</span></div>
              <div style={{ fontSize: 12, lineHeight: 1.5 }}>{d.summary}</div>
            </div>
          )}
          {tpl.layout === "single" && skillsList.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div className="mb-1.5"><span style={{ fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", fontWeight: 700, color: tpl.headerText, borderBottom: tpl.divider, paddingBottom: 3, display: "inline-block" }}>Skills</span></div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, fontSize: 11 }}>
                {skillsList.map((s, i) => <span key={i} style={{ border: `1px solid ${tpl.mutedText}`, borderRadius: 10, padding: "1px 7px" }}>{s}</span>)}
              </div>
            </div>
          )}
          {d.experience.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div className="mb-1.5"><span style={{ fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", fontWeight: 700, color: tpl.headerText, borderBottom: tpl.divider, paddingBottom: 3, display: "inline-block" }}>Experience</span></div>
              {d.experience.map((e, i) => (
                <div key={i} style={{ marginBottom: 10, fontSize: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontWeight: 700, color: tpl.headerText }}>{e.title || "Role"} {e.company && <span style={{ fontWeight: 400 }}>· {e.company}</span>}</span>
                    <span style={{ color: tpl.mutedText, whiteSpace: "nowrap", fontSize: 11 }}>{e.dates}</span>
                  </div>
                  <ul style={{ margin: "3px 0", paddingLeft: 16 }}>
                    {e.bullets.filter(Boolean).map((b, j) => <li key={j} style={{ lineHeight: 1.5, marginBottom: 1 }}>{b}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          )}
          {tpl.layout === "single" && d.education.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div className="mb-1.5"><span style={{ fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", fontWeight: 700, color: tpl.headerText, borderBottom: tpl.divider, paddingBottom: 3, display: "inline-block" }}>Education</span></div>
              {d.education.map((e, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12, marginBottom: 6 }}>
                  <span><span style={{ fontWeight: 700, color: tpl.headerText }}>{e.institution || "School"}</span> {e.degree && <span>· {e.degree}</span>}</span>
                  <span style={{ color: tpl.mutedText, fontSize: 11, whiteSpace: "nowrap" }}>{e.dates}</span>
                </div>
              ))}
            </div>
          )}
          {d.projects.length > 0 && (
            <div>
              <div className="mb-1.5"><span style={{ fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", fontWeight: 700, color: tpl.headerText, borderBottom: tpl.divider, paddingBottom: 3, display: "inline-block" }}>Projects</span></div>
              {d.projects.map((p, i) => (
                <div key={i} style={{ marginBottom: 8, fontSize: 12 }}>
                  <span style={{ fontWeight: 700, color: tpl.headerText }}>{p.name || "Project"}</span>
                  {p.description && <div style={{ fontSize: 12, marginTop: 1 }}>{p.description}</div>}
                  {p.link && <div style={{ color: tpl.mutedText, fontSize: 11 }}>{p.link}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main id="main-content" className="flex-1 pt-24 pb-12">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 text-sm font-medium text-emerald-300 mb-4">
              <FileText className="h-3.5 w-3.5" />
              Resume Builder
            </div>
            <h1 className="text-3xl md:text-5xl font-bold">Build Your <span className="text-gradient">Resume</span></h1>
            <p className="mt-3 text-muted-foreground text-lg max-w-2xl mx-auto">
              Enter your details, pick a template, preview live, and download your resume
            </p>
          </div>

          <Card className="border border-border/50 bg-transparent mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5 text-emerald-400" />
                Choose a Template
              </CardTitle>
              <CardDescription>Select a design theme for your resume</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSelected(t.id)}
                    className={`p-4 rounded-xl text-left border transition-all duration-300 ${
                      selected === t.id
                        ? "border-emerald-500/50 bg-gradient-to-br from-emerald-500/10 to-cyan-500/10"
                        : "border-border/50 bg-transparent hover:border-border"
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${t.accent} mb-3`} />
                    <p className="font-semibold text-sm">{t.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t.desc}</p>
                    {selected === t.id && (
                      <div className="mt-2">
                        <Badge className="bg-gradient-brand text-white border-0 text-xs">Selected</Badge>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid lg:grid-cols-2 gap-6">
            <Card className="border border-border/50 bg-transparent">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-emerald-400" />
                  Your Details
                </CardTitle>
                <CardDescription>{loadingResume ? "Loading resume data..." : "Fill in your information"}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5"><User className="h-3 w-3" /> Personal Info</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2"><label className={labelCls}>Full Name</label><Input value={data.name} onChange={(e) => set("name", e.target.value)} placeholder="John Doe" /></div>
                    <div className="col-span-2"><label className={labelCls}>Professional Title</label><Input value={data.title} onChange={(e) => set("title", e.target.value)} placeholder="Senior Software Engineer" /></div>
                    <div><label className={labelCls}>Email</label><Input value={data.email} onChange={(e) => set("email", e.target.value)} placeholder="john@email.com" /></div>
                    <div><label className={labelCls}>Phone</label><Input value={data.phone} onChange={(e) => set("phone", e.target.value)} placeholder="(555) 123-4567" /></div>
                    <div><label className={labelCls}>Location</label><Input value={data.location} onChange={(e) => set("location", e.target.value)} placeholder="New York, NY" /></div>
                    <div><label className={labelCls}>LinkedIn</label><Input value={data.linkedin} onChange={(e) => set("linkedin", e.target.value)} placeholder="linkedin.com/in/johndoe" /></div>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5"><AlignLeft className="h-3 w-3" /> Summary</p>
                  <Textarea className="min-h-[80px] bg-background/50" placeholder="Accomplished software engineer with 6+ years of experience..." value={data.summary} onChange={(e) => set("summary", e.target.value)} />
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5"><Wrench className="h-3 w-3" /> Skills</p>
                  <Input value={data.skills} onChange={(e) => set("skills", e.target.value)} placeholder="Python, React, SQL, AWS" />
                  <p className="text-[11px] text-muted-foreground">Comma-separated list</p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5"><Briefcase className="h-3 w-3" /> Experience</p>
                    <Button size="sm" variant="outline" className="border-border text-emerald-400 hover:text-emerald-300" onClick={() => set("experience", [...data.experience, { title: "", company: "", dates: "", bullets: [""] }])}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add
                    </Button>
                  </div>
                  {data.experience.map((e, i) => (
                    <div key={i} className="p-3 rounded-lg border border-border/50 bg-muted/30 space-y-2 relative">
                      <button className="absolute top-2 right-2 text-muted-foreground hover:text-red-400" onClick={() => set("experience", data.experience.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5" /></button>
                      <div className="grid grid-cols-2 gap-2">
                        <Input value={e.title} onChange={(ev) => setExp(i, "title", ev.target.value)} placeholder="Job title" />
                        <Input value={e.company} onChange={(ev) => setExp(i, "company", ev.target.value)} placeholder="Company" />
                      </div>
                      <Input value={e.dates} onChange={(ev) => setExp(i, "dates", ev.target.value)} placeholder="Jan 2020 - Present" />
                      {e.bullets.map((b, j) => (
                        <div key={j} className="flex gap-2">
                          <Input value={b} onChange={(ev) => setBullet(i, j, ev.target.value)} placeholder="Achievement / responsibility" />
                          <Button size="icon" variant="outline" className="border-border shrink-0 h-9 w-9" onClick={() => setExp(i, "bullets", e.bullets.filter((_, k) => k !== j))}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      ))}
                      <Button size="sm" variant="ghost" className="text-emerald-400 hover:text-emerald-300 text-xs" onClick={() => setExp(i, "bullets", [...e.bullets, ""])}>
                        <Plus className="h-3 w-3 mr-1" /> Add bullet
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5"><GraduationCap className="h-3 w-3" /> Education</p>
                    <Button size="sm" variant="outline" className="border-border text-emerald-400 hover:text-emerald-300" onClick={() => set("education", [...data.education, { institution: "", degree: "", dates: "" }])}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add
                    </Button>
                  </div>
                  {data.education.map((e, i) => (
                    <div key={i} className="p-3 rounded-lg border border-border/50 bg-muted/30 space-y-2 relative">
                      <button className="absolute top-2 right-2 text-muted-foreground hover:text-red-400" onClick={() => set("education", data.education.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5" /></button>
                      <Input value={e.institution} onChange={(ev) => setEdu(i, "institution", ev.target.value)} placeholder="University / School" />
                      <div className="grid grid-cols-2 gap-2">
                        <Input value={e.degree} onChange={(ev) => setEdu(i, "degree", ev.target.value)} placeholder="B.S. Computer Science" />
                        <Input value={e.dates} onChange={(ev) => setEdu(i, "dates", ev.target.value)} placeholder="2015 - 2019" />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5"><FolderGit2 className="h-3 w-3" /> Projects</p>
                    <Button size="sm" variant="outline" className="border-border text-emerald-400 hover:text-emerald-300" onClick={() => set("projects", [...data.projects, { name: "", description: "", link: "" }])}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add
                    </Button>
                  </div>
                  {data.projects.map((p, i) => (
                    <div key={i} className="p-3 rounded-lg border border-border/50 bg-muted/30 space-y-2 relative">
                      <button className="absolute top-2 right-2 text-muted-foreground hover:text-red-400" onClick={() => set("projects", data.projects.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5" /></button>
                      <Input value={p.name} onChange={(ev) => setProj(i, "name", ev.target.value)} placeholder="Project name" />
                      <Textarea className="min-h-[60px] bg-background/50" value={p.description} onChange={(ev) => setProj(i, "description", ev.target.value)} placeholder="What did you build?" />
                      <Input value={p.link} onChange={(ev) => setProj(i, "link", ev.target.value)} placeholder="github.com/yourproject" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border/50 bg-transparent self-start lg:sticky lg:top-24">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5 text-emerald-400" />
                  Live Preview
                </CardTitle>
                <CardDescription>{tpl.name} template</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div tabIndex={0} role="region" aria-label="Resume preview" className="rounded-lg overflow-hidden shadow-2xl ring-1 ring-black/40 max-h-[600px] overflow-y-auto">{preview}</div>
                {!hasAnyData(data) && (
                  <p className="text-[11px] text-amber-400/90 text-center bg-amber-950/20 border border-amber-800/30 rounded-lg px-3 py-2">
                    Showing sample content — fill in your details on the left and it will be replaced automatically.
                  </p>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <Button onClick={downloadResume} className="bg-gradient-brand hover:opacity-90 text-white glow-brand">
                    <Download className="mr-2 h-4 w-4" /> Download
                  </Button>
                  <Button variant="outline" className="border-border" onClick={printResume}>
                    <Printer className="mr-2 h-4 w-4" /> Print / PDF
                  </Button>
                </div>
                <div className="text-center">
                  <a href="/analyze" className="text-xs text-muted-foreground hover:text-emerald-400">
                    <Sparkles className="inline h-3 w-3 mr-1" />Auto-fill from an analyzed resume
                  </a>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

function esc(s: string) {
  return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

export default function BuilderPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col min-h-screen">
        <Header />
        <main className="flex-1 flex items-center justify-center pt-24">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
        </main>
      </div>
    }>
      <BuilderInner />
    </Suspense>
  )
}
