import Link from "next/link"
import { FileText } from "lucide-react"

export default function Footer() {
  const currentYear = new Date().getFullYear()
  return (
    <footer className="border-t border-border/50 py-12">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-4 gap-8 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="bg-gradient-brand p-1 rounded glow-brand">
                <FileText className="h-4 w-4 text-white" />
              </div>
              <span className="font-bold text-gradient">ResumeIQ</span>
            </div>
            <p className="text-sm text-muted-foreground max-w-xs">
              AI-powered resume analysis and career optimization tools.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-3">Product</h4>
            <div className="flex flex-col gap-2">
              <Link href="/analyze" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Resume Analyzer</Link>
              <Link href="/jd-match" className="text-sm text-muted-foreground hover:text-foreground transition-colors">JD Matching</Link>
              <Link href="/cover-letter" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Cover Letter</Link>
              <Link href="/builder" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Resume Builder</Link>
              <Link href="/interview" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Interview Prep</Link>
              <Link href="/recruiter" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Recruiter</Link>
            </div>
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-3">Company</h4>
            <div className="flex flex-col gap-2">
              <Link href="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
            </div>
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-3">Legal</h4>
            <div className="flex flex-col gap-2">
              <span className="text-sm text-muted-foreground">Privacy Policy</span>
              <span className="text-sm text-muted-foreground">Terms of Service</span>
            </div>
          </div>
        </div>
        <div className="border-t border-border/50 pt-6 text-center text-sm text-muted-foreground">
          &copy; {currentYear} ResumeIQ. All rights reserved.
        </div>
      </div>
    </footer>
  )
}
