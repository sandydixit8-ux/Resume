"use client"

import Link from "next/link"
import { useState } from "react"
import { FileText, Menu, X, ChevronDown, Shield, Brain } from "lucide-react"
import { Button } from "@/components/ui/button"

const navItems = {
  Product: [
    { label: "Resume Analyzer", to: "/analyze" },
    { label: "JD Matching", to: "/jd-match" },
    { label: "Cover Letter", to: "/cover-letter" },
    { label: "Resume Builder", to: "/builder" },
    { label: "Interview Prep", to: "/interview" },
    { label: "Recruiter", to: "/recruiter" },
  ],
  Company: [
    { label: "Pricing", to: "/pricing" },
  ],
}

export default function Header() {
  const [open, setOpen] = useState(false)

  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="bg-gradient-brand p-1.5 rounded-lg glow-brand transition-transform duration-300 group-hover:scale-105">
            <FileText className="h-5 w-5 text-white" />
          </div>
          <span className="font-bold text-xl text-gradient">ResumeIQ</span>
        </Link>

        <nav className="hidden lg:flex items-center gap-6">
          <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground transition-colors font-medium">
            Dashboard
          </Link>
          <Link href="/analyze" className="text-sm text-muted-foreground hover:text-foreground transition-colors font-medium">
            Analyzer
          </Link>
          <Link href="/jd-match" className="text-sm text-muted-foreground hover:text-foreground transition-colors font-medium">
            JD Matching
          </Link>
          <Link href="/cover-letter" className="text-sm text-muted-foreground hover:text-foreground transition-colors font-medium">
            Cover Letter
          </Link>
          <Link href="/builder" className="text-sm text-muted-foreground hover:text-foreground transition-colors font-medium">
            Builder
          </Link>
          <Link href="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors font-medium">
            Pricing
          </Link>
        </nav>

        <div className="hidden lg:flex items-center gap-2">
          <Link href="/interview">
            <Button size="sm" className="bg-gradient-cyan hover:opacity-90 text-white glow-cyan">
              <Brain className="mr-1.5 h-3.5 w-3.5" /> Interview Prep
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button size="sm" className="bg-gradient-brand hover:opacity-90 text-white glow-brand">
              Dashboard <ChevronDown className="ml-1 h-3 w-3" />
            </Button>
          </Link>
          <Link href="/admin/login">
            <Button size="sm" variant="outline" className="border-border text-muted-foreground hover:text-foreground">
              <Shield className="mr-1.5 h-3.5 w-3.5" /> Login
            </Button>
          </Link>
        </div>

        <button onClick={() => setOpen(!open)} className="lg:hidden p-2 text-muted-foreground hover:text-foreground">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="lg:hidden border-t border-border/50 bg-background/95 backdrop-blur-md">
          <div className="container mx-auto px-4 py-4 flex flex-col gap-3">
            <Link href="/dashboard" className="text-sm font-medium py-2 hover:text-gradient" onClick={() => setOpen(false)}>Dashboard</Link>
            <Link href="/analyze" className="text-sm font-medium py-2 hover:text-gradient" onClick={() => setOpen(false)}>Resume Analyzer</Link>
            <Link href="/jd-match" className="text-sm font-medium py-2 hover:text-gradient" onClick={() => setOpen(false)}>JD Matching</Link>
            <Link href="/cover-letter" className="text-sm font-medium py-2 hover:text-gradient" onClick={() => setOpen(false)}>Cover Letter</Link>
            <Link href="/builder" className="text-sm font-medium py-2 hover:text-gradient" onClick={() => setOpen(false)}>Resume Builder</Link>
            <Link href="/interview" className="text-sm font-medium py-2 hover:text-gradient" onClick={() => setOpen(false)}>Interview Prep</Link>
            <Link href="/recruiter" className="text-sm font-medium py-2 hover:text-gradient" onClick={() => setOpen(false)}>Recruiter</Link>
            <div className="border-t border-border/50 pt-3">
              <Link href="/pricing" className="text-sm font-medium py-2 hover:text-gradient" onClick={() => setOpen(false)}>Pricing</Link>
              <Link href="/admin/login" className="text-sm font-medium py-2 flex items-center gap-2 text-muted-foreground hover:text-emerald-400" onClick={() => setOpen(false)}>
                <Shield className="h-3.5 w-3.5" /> Admin Login
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
