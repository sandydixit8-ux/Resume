"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select } from "@/components/ui/select"
import Header from "@/components/header"
import Footer from "@/components/footer"
import {
  FileText, Sparkles, Download, Eye, Palette, Plus, Trash2,
  Loader2, Printer, User, Briefcase, GraduationCap, FolderGit2, Wrench, AlignLeft,
  Globe, MapPin, Award,
} from "lucide-react"
import { getResume, getCountries, getCountry, exportResume } from "@/lib/api"
import Reveal from "@/components/reveal"

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
  country: string
  international: Record<string, string>
  summary: string
  skills: string
  certifications: string
  experience: Experience[]
  education: Education[]
  projects: Project[]
}

const emptyData: ResumeData = {
  name: "", title: "", email: "", phone: "", location: "", linkedin: "", website: "",
  country: "us", international: {},
  summary: "",
  skills: "",
  certifications: "",
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
  country: "us", international: {},
  summary:
    "Results-driven software engineer with 7+ years of experience building scalable web applications. Proven track record of leading cross-functional teams, improving system performance by 40%, and shipping products used by millions of users.",
  skills: "JavaScript, TypeScript, React, Node.js, Python, SQL, AWS, Docker, Kubernetes, CI/CD",
  certifications: "",
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
    d.summary || d.skills || d.certifications || d.experience.length > 0 || d.education.length > 0 || d.projects.length > 0 ||
    Object.keys(d.international).some((k) => d.international[k])
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

const INTL_FIELDS: Record<string, string> = {
  date_of_birth: "Date of Birth",
  nationality: "Nationality",
  visa_status: "Visa Status",
  work_authorization: "Work Authorization",
  marital_status: "Marital Status",
  religion: "Religion",
  father_name: "Father's Name",
  driving_license: "Driving License",
  current_location: "Current Location",
  notice_period: "Notice Period",
  passport: "Passport",
  relocation: "Relocation",
  remote_availability: "Remote Availability",
  travel_availability: "Travel Availability",
  timezone: "Timezone",
  languages: "Languages",
}

function toParsedJson(d: ResumeData): Record<string, unknown> {
  const parts = (d.name || "").trim().split(/\s+/)
  const langs = (d.international.languages || "").split(",").map((s) => s.trim()).filter(Boolean)
  const personal: Record<string, unknown> = {
    name: d.name,
    first_name: parts[0] || "",
    last_name: parts.slice(1).join(" ") || "",
    email: d.email,
    phone: d.phone,
    location: d.location,
    linkedin: d.linkedin,
    website: d.website,
  }
  for (const [k, v] of Object.entries(d.international)) {
    if (k !== "languages" && v) personal[k] = v
  }
  if (langs.length) personal.languages = langs
  return {
    personal,
    summary: d.summary,
    skills: d.skills.split(",").map((s) => s.trim()).filter(Boolean),
    certifications: d.certifications.split(",").map((s) => s.trim()).filter(Boolean),
    experience: d.experience.map((e) => ({ title: e.title, company: e.company, dates: e.dates, bullets: e.bullets.filter(Boolean) })),
    education: d.education.map((e) => ({ institution: e.institution, degree: e.degree, dates: e.dates })),
    projects: d.projects.map((p) => ({ name: p.name, description: p.description, link: p.link })),
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
  {
    id: "corporate", name: "Corporate", desc: "Clean business standard", accent: "from-slate-400 to-slate-600",
    font: "Arial, sans-serif", layout: "single", headerCenter: false,
    headerBg: "#1e293b", headerText: "#f8fafc", bodyText: "#334155", mutedText: "#64748b",
    divider: "2px solid #475569", nameSize: "28px", sectionLabel: "BOLD UPPERCASE WITH RULE",
  },
  {
    id: "government", name: "Government", desc: "Public-sector formal", accent: "from-blue-400 to-blue-600",
    font: "'Times New Roman', serif", layout: "single", headerCenter: false,
    headerBg: "#ffffff", headerText: "#1e3a8a", bodyText: "#1f2937", mutedText: "#4b5563",
    divider: "2px solid #1e40af", nameSize: "28px", sectionLabel: "UPPERCASE HEADINGS",
  },
  {
    id: "consulting", name: "Consulting", desc: "Clean & structured", accent: "from-blue-400 to-sky-600",
    font: "Helvetica, Arial, sans-serif", layout: "single", headerCenter: false,
    headerBg: "#ffffff", headerText: "#0f172a", bodyText: "#334155", mutedText: "#64748b",
    divider: "1px solid #3b82f6", nameSize: "28px", sectionLabel: "SMALL CAPS WITH RULE",
  },
  {
    id: "mckinsey", name: "McKinsey Style", desc: "Sleek minimal consulting", accent: "from-slate-500 to-slate-700",
    font: "Georgia, serif", layout: "single", headerCenter: true,
    headerBg: "#ffffff", headerText: "#1f2937", bodyText: "#374151", mutedText: "#6b7280",
    divider: "1px solid #9ca3af", nameSize: "30px", sectionLabel: "CENTERED UPPERCASE",
  },
  {
    id: "bcg", name: "BCG Style", desc: "Impact-led consulting", accent: "from-blue-400 to-indigo-600",
    font: "Helvetica, Arial, sans-serif", layout: "single", headerCenter: false,
    headerBg: "#ffffff", headerText: "#1e3a8a", bodyText: "#1f2937", mutedText: "#4b5563",
    divider: "2px solid #2563eb", nameSize: "28px", sectionLabel: "BOLD UPPERCASE",
  },
  {
    id: "big4", name: "Big 4 Style", desc: "Audit-ready professional", accent: "from-zinc-400 to-zinc-700",
    font: "Arial, sans-serif", layout: "single", headerCenter: false,
    headerBg: "#ffffff", headerText: "#111827", bodyText: "#374151", mutedText: "#6b7280",
    divider: "1px solid #374151", nameSize: "28px", sectionLabel: "UPPERCASE WITH RULE",
  },
  {
    id: "finance", name: "Finance", desc: "Banking & investment", accent: "from-emerald-400 to-emerald-600",
    font: "Georgia, serif", layout: "single", headerCenter: false,
    headerBg: "#022c22", headerText: "#ecfdf5", bodyText: "#064e3b", mutedText: "#047857",
    divider: "1px solid #059669", nameSize: "28px", sectionLabel: "UPPERCASE BANKING STYLE",
  },
  {
    id: "legal", name: "Legal", desc: "Law firm standard", accent: "from-zinc-500 to-zinc-800",
    font: "'Times New Roman', serif", layout: "single", headerCenter: false,
    headerBg: "#ffffff", headerText: "#111827", bodyText: "#1f2937", mutedText: "#4b5563",
    divider: "1px solid #111827", nameSize: "28px", sectionLabel: "UPPERCASE LEGAL STYLE",
  },
  {
    id: "healthcare", name: "Healthcare", desc: "Medical professional", accent: "from-teal-400 to-cyan-600",
    font: "Arial, sans-serif", layout: "single", headerCenter: false,
    headerBg: "#f0fdfa", headerText: "#134e4a", bodyText: "#134e4a", mutedText: "#0f766e",
    divider: "2px solid #0d9488", nameSize: "28px", sectionLabel: "UPPERCASE WITH RULE",
  },
  {
    id: "academic", name: "Academic", desc: "Research & teaching CV", accent: "from-indigo-400 to-violet-600",
    font: "'Times New Roman', serif", layout: "single", headerCenter: true,
    headerBg: "#ffffff", headerText: "#312e81", bodyText: "#1f2937", mutedText: "#4f46e5",
    divider: "1px solid #4338ca", nameSize: "30px", sectionLabel: "UPPERCASE SECTIONS",
  },
  {
    id: "engineering", name: "Engineering", desc: "Technical & precise", accent: "from-cyan-400 to-blue-600",
    font: "'Consolas', monospace", layout: "two", headerCenter: false,
    headerBg: "#ffffff", headerText: "#0f172a", bodyText: "#1e293b", mutedText: "#475569",
    divider: "2px solid #0891b2", nameSize: "26px", sectionLabel: "TECHNICAL HEADERS",
  },
  {
    id: "pm", name: "Project Mgmt", desc: "PMO & delivery", accent: "from-amber-400 to-yellow-600",
    font: "Arial, sans-serif", layout: "single", headerCenter: false,
    headerBg: "#ffffff", headerText: "#713f12", bodyText: "#44403c", mutedText: "#78716c",
    divider: "2px solid #d97706", nameSize: "28px", sectionLabel: "UPPERCASE WITH RULE",
  },
  {
    id: "sales", name: "Sales", desc: "Revenue-focused", accent: "from-orange-400 to-red-500",
    font: "'Helvetica Neue', Arial, sans-serif", layout: "two", headerCenter: false,
    headerBg: "#ffffff", headerText: "#7c2d12", bodyText: "#431407", mutedText: "#c2410c",
    divider: "2px solid #ea580c", nameSize: "28px", sectionLabel: "BOLD UPPERCASE",
  },
  {
    id: "marketing", name: "Marketing", desc: "Creative & modern", accent: "from-pink-400 to-rose-500",
    font: "'Trebuchet MS', sans-serif", layout: "two", headerCenter: false,
    headerBg: "#fff1f2", headerText: "#881337", bodyText: "#4c0519", mutedText: "#be123c",
    divider: "2px solid #e11d48", nameSize: "28px", sectionLabel: "UPPERCASE ACCENT",
  },
  {
    id: "startup", name: "Startup", desc: "Bold & energetic", accent: "from-violet-400 to-fuchsia-600",
    font: "'Helvetica Neue', Arial, sans-serif", layout: "two", headerCenter: false,
    headerBg: "#1e1b4b", headerText: "#ede9fe", bodyText: "#e0e7ff", mutedText: "#a5b4fc",
    divider: "2px solid #8b5cf6", nameSize: "28px", sectionLabel: "MODERN UPPERCASE",
  },
  {
    id: "europass", name: "Europass", desc: "EU CV standard", accent: "from-blue-400 to-blue-600",
    font: "Arial, sans-serif", layout: "single", headerCenter: true,
    headerBg: "#ffffff", headerText: "#1e3a8a", bodyText: "#1f2937", mutedText: "#4b5563",
    divider: "1px solid #2563eb", nameSize: "28px", sectionLabel: "UPPERCASE SECTIONS",
  },
  {
    id: "amazon", name: "Amazon Style", desc: "Leadership principles", accent: "from-amber-400 to-orange-500",
    font: "'Amazon Ember', Arial, sans-serif", layout: "single", headerCenter: false,
    headerBg: "#131a22", headerText: "#ffffff", bodyText: "#232f3e", mutedText: "#37475a",
    divider: "2px solid #febd69", nameSize: "28px", sectionLabel: "UPPERCASE WITH RULE",
  },
  {
    id: "google", name: "Google Style", desc: "Modern & clean", accent: "from-emerald-400 to-teal-600",
    font: "Roboto, Arial, sans-serif", layout: "single", headerCenter: false,
    headerBg: "#ffffff", headerText: "#202124", bodyText: "#3c4043", mutedText: "#5f6368",
    divider: "1px solid #dadce0", nameSize: "28px", sectionLabel: "UPPERCASE WITH RULE",
  },
  {
    id: "microsoft", name: "Microsoft Style", desc: "Corporate modern", accent: "from-blue-400 to-cyan-600",
    font: "Segoe UI, Arial, sans-serif", layout: "single", headerCenter: false,
    headerBg: "#ffffff", headerText: "#004d79", bodyText: "#323130", mutedText: "#605e5c",
    divider: "2px solid #0078d4", nameSize: "28px", sectionLabel: "UPPERCASE WITH RULE",
  },
  {
    id: "meta", name: "Meta Style", desc: "Bold tech", accent: "from-blue-400 to-indigo-500",
    font: "'Helvetica Neue', Arial, sans-serif", layout: "two", headerCenter: false,
    headerBg: "#0d1b2a", headerText: "#ffffff", bodyText: "#1b263b", mutedText: "#415a77",
    divider: "2px solid #1877f2", nameSize: "28px", sectionLabel: "BOLD UPPERCASE",
  },
]

const inputCls = "flex h-9 w-full rounded-md border border-input bg-background/50 px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
const labelCls = "text-xs font-medium text-muted-foreground mb-1 block"

function BuilderInner() {
  const searchParams = useSearchParams()
  const [selected, setSelected] = useState("modern")
  const [data, setData] = useState<ResumeData>(emptyData)
  const [loadingResume, setLoadingResume] = useState(false)
  const [countries, setCountries] = useState<{ code: string; name: string; fields: string[] }[]>([])
  const [countryInfo, setCountryInfo] = useState<Record<string, any> | null>(null)
  const [exporting, setExporting] = useState<string | null>(null)

  useEffect(() => {
    getCountries().then((r) => setCountries(r.countries || [])).catch(() => {})
  }, [])

  useEffect(() => {
    if (!data.country) return
    getCountry(data.country).then((r) => setCountryInfo(r.country || null)).catch(() => setCountryInfo(null))
  }, [data.country])

  useEffect(() => {
    const resumeId = searchParams.get("resume_id")
    if (resumeId) {
      setLoadingResume(true)
      getResume(Number(resumeId)).then((r) => {
        const p = r.parsed_json || {}
        const personal = p.personal || {}
        setData({
          name: p.contact_info?.name || personal.name || "",
          title: p.experience?.[0]?.title || "",
          email: p.contact_info?.email || personal.email || "",
          phone: p.contact_info?.phone || personal.phone || "",
          location: p.contact_info?.location || personal.location || "",
          linkedin: p.contact_info?.linkedin || personal.linkedin || "",
          website: personal.website || "",
          country: p.country_code || personal.country_code || "us",
          international: Object.fromEntries(
            Object.entries(personal)
              .filter(([k, v]) => k in INTL_FIELDS && v !== null && v !== undefined)
              .map(([k, v]) => [k, Array.isArray(v) ? v.join(", ") : String(v)])
          ),
          summary: p.summary || "",
          skills: (p.skills || []).join(", "),
          certifications: (p.certifications || []).map((c: any) => (typeof c === "string" ? c : c.name || "")).join(", "),
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
  const intlList = Object.entries(d.international).filter(([k, v]) => k in INTL_FIELDS && v)

  function set<K extends keyof ResumeData>(key: K, value: ResumeData[K]) {
    setData((d) => ({ ...d, [key]: value }))
  }
  function setInt(key: string, value: string) {
    setData((d) => ({ ...d, international: { ...d.international, [key]: value } }))
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
    const intlLine = Object.entries(d.international).filter(([k, v]) => k in INTL_FIELDS && v).map(([, v]) => esc(v)).join(" | ")
    const skills = d.skills.split(",").map((s) => s.trim()).filter(Boolean)
    const certs = d.certifications.split(",").map((s) => s.trim()).filter(Boolean)
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
    ${intlLine ? `<div class="contact">${intlLine}</div>` : ""}
  </div>
  ${d.summary ? `<div class="section">Profile</div><div>${esc(d.summary)}</div>` : ""}
  ${skills.length ? `<div class="section">Skills</div><div class="skills">${skills.map((s) => `<span class="skill">${esc(s)}</span>`).join("")}</div>` : ""}
  ${d.experience.length ? `<div class="section">Experience</div>${expHtml}` : ""}
  ${certs.length ? `<div class="section">Certifications</div><ul>${certs.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>` : ""}
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

  async function doExport(format: string) {
    if (exporting) return
    setExporting(format)
    try {
      const { blob, filename } = await exportResume({
        format,
        country: data.country || "us",
        template: selected,
        parsed_json: toParsedJson(effectiveData(data)),
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      alert("Export failed: " + (e instanceof Error ? e.message : String(e)))
    } finally {
      setExporting(null)
    }
  }

  const exportFormats: { id: string; label: string }[] = [
    { id: "pdf", label: "PDF" },
    { id: "docx", label: "DOCX" },
    { id: "html", label: "HTML" },
    { id: "md", label: "Markdown" },
    { id: "json", label: "JSON" },
    { id: "tex", label: "LaTeX" },
    { id: "europass", label: "Europass XML" },
  ]

  const preview = (
    <div style={{ fontFamily: tpl.font, color: tpl.bodyText, background: "#fff", minHeight: 600, borderRadius: 8 }}>
      <div style={{ borderBottom: tpl.divider, padding: "18px 20px", marginBottom: 0, textAlign: tpl.headerCenter ? "center" : "left", background: tpl.headerBg, color: tpl.headerText }}>
        <div style={{ fontSize: tpl.nameSize, fontWeight: 800, lineHeight: 1.1 }}>{d.name || "Your Name"}</div>
        {d.title && <div style={{ fontSize: 14, marginTop: 2, opacity: 0.9 }}>{d.title}</div>}
        <div style={{ fontSize: 12, color: tpl.mutedText, marginTop: 6, display: "flex", flexWrap: "wrap", gap: "4px 12px", justifyContent: tpl.headerCenter ? "center" : "flex-start" }}>
          {[d.email, d.phone, d.location, d.linkedin, d.website].filter(Boolean).map((c, i) => <span key={i}>{c}</span>)}
        </div>
        {intlList.length > 0 && (
          <div style={{ fontSize: 11, color: tpl.mutedText, marginTop: 4, display: "flex", flexWrap: "wrap", gap: "4px 12px", justifyContent: tpl.headerCenter ? "center" : "flex-start" }}>
            {intlList.map(([k, v], i) => <span key={i}><strong style={{ fontWeight: 600 }}>{INTL_FIELDS[k]}:</strong> {v}</span>)}
          </div>
        )}
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
          {d.certifications.trim() && (
            <div style={{ marginBottom: 14 }}>
              <div className="mb-1.5"><span style={{ fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", fontWeight: 700, color: tpl.headerText, borderBottom: tpl.divider, paddingBottom: 3, display: "inline-block" }}>Certifications</span></div>
              <ul style={{ margin: "3px 0", paddingLeft: 16 }}>
                {d.certifications.split(",").map((c) => c.trim()).filter(Boolean).map((c, i) => <li key={i} style={{ fontSize: 12, lineHeight: 1.5 }}>{c}</li>)}
              </ul>
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
          <Reveal className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 text-sm font-medium text-emerald-300 mb-4">
              <FileText className="h-3.5 w-3.5" />
              Resume Builder
            </div>
            <h1 className="text-3xl md:text-5xl font-bold">Build Your <span className="text-gradient">Resume</span></h1>
            <p className="mt-3 text-muted-foreground text-lg max-w-2xl mx-auto">
              Enter your details, pick a template, preview live, and download your resume
            </p>
          </Reveal>

          <Reveal delay={1}>
          <Card className="border border-border/50 bg-transparent mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5 text-emerald-400" />
                Choose a Template
              </CardTitle>
              <CardDescription>Select a design theme for your resume</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
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
          </Reveal>

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
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5"><Globe className="h-3 w-3" /> Country &amp; International</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className={labelCls}>Target Country</label>
                      <Select
                        value={data.country}
                        onChange={(e) => set("country", e.target.value)}
                        loading={countries.length === 0}
                        placeholder="Loading countries..."
                        options={countries.map((c) => ({ value: c.code, label: `${c.name} (${c.code.toUpperCase()})` }))}
                      />
                    </div>
                  </div>
                  {countryInfo?.tips && (
                    <p className="text-[11px] text-amber-300/90 bg-amber-950/20 border border-amber-800/30 rounded-lg px-3 py-2 flex items-start gap-1.5">
                      <Sparkles className="h-3 w-3 mt-0.5 shrink-0" />
                      <span>{countryInfo.tips}</span>
                    </p>
                  )}
                  {(countryInfo?.fields || []).filter((f: string) => f !== "photo").length > 0 && (
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      {(countryInfo?.fields || []).filter((f: string) => f !== "photo").map((f: string) => (
                        <div key={f} className={f === "languages" ? "col-span-2" : ""}>
                          <label className={labelCls}>{INTL_FIELDS[f] || f}</label>
                          <Input value={data.international[f] || ""} onChange={(e) => setInt(f, e.target.value)} placeholder={f === "languages" ? "English (native), Spanish (fluent)" : ""} />
                        </div>
                      ))}
                    </div>
                  )}
                  {countryInfo?.photo === "yes" && (
                    <p className="text-[11px] text-muted-foreground"><MapPin className="inline h-3 w-3 mr-1" />This country typically expects a photo on the CV (add one after download).</p>
                  )}
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

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5"><Award className="h-3 w-3" /> Certifications</p>
                  <Input value={data.certifications} onChange={(e) => set("certifications", e.target.value)} placeholder="AWS Certified Solutions Architect, PMP" />
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
                    <Download className="mr-2 h-4 w-4" /> Download HTML
                  </Button>
                  <Button variant="outline" className="border-border" onClick={printResume}>
                    <Printer className="mr-2 h-4 w-4" /> Print / PDF
                  </Button>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide text-center">Download As</p>
                  <div className="grid grid-cols-4 gap-2">
                    {exportFormats.map((f) => (
                      <Button key={f.id} size="sm" variant="outline" className="border-border text-xs px-1" disabled={exporting === f.id} onClick={() => doExport(f.id)}>
                        {exporting === f.id ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Download className="mr-1 h-3 w-3" />} {f.label}
                      </Button>
                    ))}
                  </div>
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
