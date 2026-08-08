"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Header from "@/components/header"
import Footer from "@/components/footer"
import { getPaymentConfig } from "@/lib/api"
import Reveal from "@/components/reveal"
import AnimatedCounter from "@/components/animated-counter"
import {
  ArrowRight, Sparkles, FileText, Search, Edit, FileCheck, Target, ChevronRight,
  Check, Brain, Upload, TrendingUp, Download,
} from "lucide-react"

const features = [
  {
    icon: Brain,
    title: "Smart Parsing",
    desc: "Automatically extract and structure your resume data — skills, experience, education — with high accuracy.",
    link: "/analyze",
    color: "text-emerald-400",
    bg: "bg-emerald-500/15",
  },
  {
    icon: Search,
    title: "Keyword Analysis",
    desc: "Identify missing keywords and optimize your resume to rank higher in ATS filters and recruiter searches.",
    link: "/analyze",
    color: "text-cyan-400",
    bg: "bg-cyan-500/15",
  },
  {
    icon: Target,
    title: "Match Score",
    desc: "Compare your resume against any job description and get a detailed match score with actionable insights.",
    link: "/jd-match",
    color: "text-indigo-400",
    bg: "bg-indigo-500/15",
  },
  {
    icon: FileText,
    title: "Cover Letter Generator",
    desc: "Generate personalized, ATS-friendly cover letters tailored to any role, company, and tone in seconds.",
    link: "/cover-letter",
    color: "text-amber-400",
    bg: "bg-amber-500/15",
  },
  {
    icon: TrendingUp,
    title: "ATS Optimization",
    desc: "Improve your ATS compatibility score with formatting and content suggestions that real systems check.",
    link: "/analyze",
    color: "text-teal-400",
    bg: "bg-teal-500/15",
  },
  {
    icon: Edit,
    title: "Resume Builder",
    desc: "Build professional resumes with multiple templates and AI-powered content assistance.",
    link: "/builder",
    color: "text-violet-400",
    bg: "bg-violet-500/15",
  },
]

const steps = [
  {
    icon: Upload,
    title: "Upload Resume",
    desc: "Upload your PDF, DOCX, or paste your resume text. Our parser extracts all key data instantly.",
    step: "01",
  },
  {
    icon: Brain,
    title: "AI Analysis",
    desc: "Our AI scores your resume across multiple ATS dimensions, identifies gaps, and suggests improvements.",
    step: "02",
  },
  {
    icon: Download,
    title: "Get Optimized Results",
    desc: "Download your optimized resume, matching cover letter, and actionable improvement plan.",
    step: "03",
  },
]

const plans = [
  {
    name: "Free",
    price: "₹0",
    period: "forever",
    desc: "Perfect for trying things out",
    features: [
      "3 resume analyses / month",
      "Basic ATS score",
      "1 resume template",
      "1 cover letter / month",
      "Community support",
    ],
    cta: "Get Started",
    highlighted: false,
    href: "/analyze",
  },
  {
    name: "Pro",
    price: "₹1,900",
    period: "per month",
    desc: "For serious job seekers",
    features: [
      "Unlimited analyses",
      "Unlimited resume builder",
      "Unlimited cover letters",
      "JD matching",
      "AI interview prep",
      "All premium templates",
      "Priority support",
    ],
    cta: "Start Pro Trial",
    highlighted: true,
    href: "/pricing",
  },
  {
    name: "Recruiter",
    price: "₹9,900",
    period: "per month",
    desc: "For hiring teams",
    features: [
      "Everything in Pro",
      "Unlimited job posts",
      "AI candidate ranking",
      "Resume comparison",
      "Analytics dashboard",
      "Team access (5 seats)",
      "API access",
    ],
    cta: "Contact Sales",
    highlighted: false,
    href: "/pricing",
  },
]

const planIds: Record<string, string> = { Free: "free", Pro: "pro", Recruiter: "recruiter" }

function formatPrice(amount: number, symbol: string, locale = "en-IN") {
  return `${symbol}${amount.toLocaleString(locale)}`
}

export default function LandingPage() {
  const [backendPlans, setBackendPlans] = useState<Record<string, { prices: Record<string, number>; period: string; features: string[] }> | null>(null)
  const [currency, setCurrency] = useState("INR")
  const [currencySymbols, setCurrencySymbols] = useState<Record<string, string>>({ INR: "₹", USD: "$" })

  useEffect(() => {
    ;(async () => {
      try {
        const config = await getPaymentConfig()
        setBackendPlans(config.plans)
        if (config.currency_symbols) setCurrencySymbols(config.currency_symbols)
        if (config.default_currency) setCurrency(config.default_currency)
      } catch {}
    })()
  }, [])

  const symbol = currencySymbols[currency] || "₹"
  const locale = currency === "USD" ? "en-US" : "en-IN"
  const displayPlans = plans.map((p) => {
    const backend = backendPlans?.[planIds[p.name]]
    if (backend) {
      return {
        ...p,
        price: formatPrice(backend.prices?.[currency] ?? 0, symbol, locale),
        period: backend.period || p.period,
        features: backend.features.length > 0 ? backend.features : p.features,
      }
    }
    return p
  })

  return (
    <div className="flex flex-col min-h-screen">
      <Header />

      <main id="main-content" className="flex-1">
        <section className="relative min-h-[90vh] flex items-center overflow-hidden pt-24">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-indigo-950/20 to-transparent" />
          <div className="absolute top-40 -left-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl animate-aurora" />
          <div className="absolute bottom-40 -right-40 w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-3xl animate-aurora" style={{ animationDelay: "4s" }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/5 rounded-full blur-3xl animate-pulse-glow" />

          <div className="absolute hidden xl:block top-[18%] left-[10%] animate-float">
            <div className="glass rounded-xl px-4 py-3 flex items-center gap-3 animate-scale-in">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <FileCheck className="h-4 w-4 text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">ATS Score</p>
                <p className="text-sm font-bold text-emerald-400">92/100 <span className="text-emerald-500/70 text-xs">▲ 18%</span></p>
              </div>
            </div>
          </div>

          <div className="absolute hidden xl:block top-[30%] right-[8%] animate-float-delayed">
            <div className="glass rounded-xl px-4 py-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-cyan-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Cover Letter</p>
                <p className="text-sm font-bold text-cyan-300">Generated in 5s</p>
              </div>
            </div>
          </div>

          <div className="absolute hidden xl:block bottom-[24%] left-[14%] animate-float-delayed">
            <div className="glass rounded-xl px-4 py-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                <Target className="h-4 w-4 text-indigo-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">JD Match</p>
                <p className="text-sm font-bold text-indigo-300">87% match</p>
              </div>
            </div>
          </div>

          <div className="container mx-auto px-4 relative z-10">
            <div className="max-w-5xl mx-auto text-center">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 text-sm font-medium text-emerald-300 mb-8 animate-slide-up">
                <Sparkles className="h-3.5 w-3.5" />
                AI-powered career intelligence
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              </div>

              <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[0.95] mb-6 animate-slide-up" style={{ animationDelay: "0.15s" }}>
                Land Your Dream Job
                <br />
                <span className="font-serif italic text-gradient animate-gradient">Faster</span> with AI
              </h1>

              <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed animate-slide-up" style={{ animationDelay: "0.3s" }}>
                Analyze your resume, improve your ATS score, generate tailored resumes, craft cover letters,
                and match your profile against any job description &mdash; all in one platform.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center animate-slide-up" style={{ animationDelay: "0.45s" }}>
                <Button asChild size="lg" className="text-base px-8 py-6 bg-gradient-brand hover:opacity-90 text-white shadow-xl glow-brand btn-sheen group">
                  <Link href="/dashboard">
                    Start Free <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="text-base px-8 py-6 border-border text-foreground hover:bg-muted/50">
                  <Link href="#features">
                    Learn More
                  </Link>
                </Button>
              </div>

              <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto animate-slide-up" style={{ animationDelay: "0.6s" }}>
                {[
                  { value: 50000, suffix: "+", label: "Resumes analyzed" },
                  { value: 95, suffix: "%", label: "ATS improvement" },
                  { value: 50, suffix: "+", label: "Templates" },
                  { value: 29, suffix: "", label: "Countries supported" },
                ].map((s) => (
                  <div key={s.label} className="text-center">
                    <p className="text-3xl md:text-4xl font-extrabold text-gradient">
                      <AnimatedCounter target={s.value} suffix={s.suffix} />
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="py-20 md:py-28 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-950/5 to-transparent" />
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />
          <div className="container mx-auto px-4 relative">
            <Reveal className="text-center mb-4">
              <Badge className="px-4 py-1.5 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 text-emerald-300 border-emerald-500/30 text-sm font-normal">
                Everything you need
              </Badge>
            </Reveal>
            <Reveal delay={1} className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-bold mb-4">
                Powerful <span className="text-gradient animate-gradient">resume tools</span>
              </h2>
              <p className="text-muted-foreground text-lg max-w-xl mx-auto">
                From parsing to optimization — everything to help you land more interviews
              </p>
            </Reveal>
            <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {features.map((f, i) => (
                <Reveal key={i} delay={(i % 3) as 0 | 1 | 2}>
                  <Link href={f.link} className="block h-full">
                    <Card className="group h-full cursor-pointer bg-transparent border border-border/50 hover:border-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/5 transition-all duration-500 hover:-translate-y-1 overflow-hidden relative">
                      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                      <div className="absolute -top-16 -right-16 w-32 h-32 bg-emerald-500/0 rounded-full blur-2xl transition-all duration-500 group-hover:bg-emerald-500/10" />
                      <CardHeader>
                        <div className={`w-12 h-12 rounded-xl ${f.bg} flex items-center justify-center mb-3 transition-all duration-500 group-hover:scale-110 group-hover:-rotate-6 group-hover:shadow-lg group-hover:shadow-emerald-500/10`}>
                          <f.icon className={`h-6 w-6 ${f.color}`} />
                        </div>
                        <CardTitle className="text-lg flex items-center gap-2">
                          {f.title}
                          <ArrowRight className="h-4 w-4 text-emerald-400 opacity-0 -translate-x-2 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0" />
                        </CardTitle>
                        <CardDescription className="text-sm mt-2 leading-relaxed">{f.desc}</CardDescription>
                      </CardHeader>
                    </Card>
                  </Link>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20 md:py-28 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-emerald-950/5 via-transparent to-cyan-950/5" />
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />
          <div className="container mx-auto px-4 relative">
            <Reveal className="text-center mb-4">
              <Badge className="px-4 py-1.5 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 text-emerald-300 border-emerald-500/30 text-sm font-normal">
                Simple process
              </Badge>
            </Reveal>
            <Reveal delay={1} className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-bold mb-4">
                How It <span className="text-gradient animate-gradient">Works</span>
              </h2>
              <p className="text-muted-foreground text-lg max-w-xl mx-auto">
                Three simple steps to a job-winning resume
              </p>
            </Reveal>
            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {steps.map((s, i) => (
                <Reveal key={i} delay={i as 0 | 1 | 2} className="text-center group">
                  <div className="relative mb-6 inline-block">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/20 flex items-center justify-center mx-auto transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6">
                      <s.icon className="h-8 w-8 text-emerald-400 transition-transform duration-500 group-hover:scale-110" />
                    </div>
                    <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-gradient-brand text-white text-xs font-bold flex items-center justify-center glow-brand animate-bounce-subtle" style={{ animationDelay: `${i * 0.6}s` }}>
                      {s.step}
                    </div>
                  </div>
                  <h3 className="font-bold text-lg mb-2">{s.title}</h3>
                  <p className="text-sm text-muted-foreground max-w-xs mx-auto">{s.desc}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20 md:py-28 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-cyan-950/5 via-transparent to-emerald-950/5" />
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />
          <div className="container mx-auto px-4 relative">
            <Reveal className="text-center mb-4">
              <Badge className="px-4 py-1.5 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 text-emerald-300 border-emerald-500/30 text-sm font-normal">
                Pricing
              </Badge>
            </Reveal>
            <Reveal delay={1} className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-bold mb-4">
                Simple, transparent <span className="text-gradient animate-gradient">pricing</span>
              </h2>
              <p className="text-muted-foreground text-lg max-w-xl mx-auto">
                Choose the plan that fits your needs. No hidden fees.
              </p>
              <div className="flex justify-center mt-8">
                <div className="inline-flex rounded-lg border border-border/50 bg-muted/30 p-1" role="group" aria-label="Select currency">
                  {(["INR", "USD"] as const).map((c) => (
                    <button
                      key={c}
                      onClick={() => setCurrency(c)}
                      aria-pressed={currency === c}
                      className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${currency === c ? "bg-gradient-brand text-white glow-brand" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      {c} ({currencySymbols[c] || "₹"})
                    </button>
                  ))}
                </div>
              </div>
            </Reveal>
            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {displayPlans.map((p, i) => (
                <Reveal key={i} delay={i as 0 | 1 | 2} className="h-full">
                  <Card
                    className={`relative overflow-hidden border h-full ${
                      p.highlighted
                        ? "border-emerald-500/40 shadow-xl shadow-emerald-500/10 scale-105"
                        : "border-border/50"
                    } bg-transparent hover:border-emerald-500/30 transition-all duration-500 hover:-translate-y-1`}
                  >
                    {p.highlighted && (
                      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-brand animate-gradient" />
                    )}
                    {p.highlighted && (
                      <div className="absolute -top-10 -right-10 w-20 h-20 bg-gradient-brand/20 rounded-full blur-2xl animate-pulse-glow" />
                    )}
                    <CardHeader>
                      <CardTitle className="text-xl">{p.name}</CardTitle>
                      <div className="mt-2">
                        <span className="text-4xl font-extrabold">{p.price}</span>
                        <span className="text-muted-foreground ml-1 text-sm">/{p.period}</span>
                      </div>
                      <CardDescription className="mt-1">{p.desc}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-3 mb-8">
                        {p.features.map((f, j) => (
                          <li key={j} className="flex items-start gap-3 text-sm">
                            <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                      <Button asChild
                        className={`w-full ${
                          p.highlighted
                            ? "bg-gradient-brand hover:opacity-90 text-white glow-brand btn-sheen"
                            : "bg-muted hover:bg-muted/80 text-foreground"
                        }`}
                      >
                        <Link href={p.href}>
                          {p.cta} {p.highlighted && <ChevronRight className="ml-2 h-4 w-4" />}
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20 relative">
          <div className="container mx-auto px-4 text-center relative">
            <Reveal variant="zoom">
              <div className="max-w-3xl mx-auto rounded-2xl p-12 md:p-16 relative overflow-hidden border border-emerald-500/20 glow-brand" style={{ background: "linear-gradient(135deg, rgba(47,198,127,0.08), rgba(20,27,35,0.8))" }}>
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-cyan-500/5" />
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />
                <div className="absolute -top-20 -right-20 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl animate-aurora" />
                <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-cyan-500/10 rounded-full blur-3xl animate-aurora" style={{ animationDelay: "5s" }} />
                <h2 className="text-3xl md:text-5xl font-bold mb-6 relative">
                  Ready to <span className="text-gradient animate-gradient">transform</span> your job search?
                </h2>
                <p className="text-muted-foreground text-lg mb-8 max-w-lg mx-auto relative">
                  Join thousands of job seekers who landed interviews with AI-optimized resumes.
                </p>
                <div className="relative flex flex-col sm:flex-row gap-4 justify-center">
                  <Button asChild size="lg" className="text-base px-10 py-6 bg-gradient-brand hover:opacity-90 text-white shadow-xl glow-brand btn-sheen group">
                    <Link href="/dashboard">
                      Get Started Free <ChevronRight className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                    </Link>
                  </Button>
                  <Button asChild size="lg" variant="outline" className="text-base px-10 py-6 border-border group">
                    <Link href="/analyze">
                      Analyze Resume <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                    </Link>
                  </Button>
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
