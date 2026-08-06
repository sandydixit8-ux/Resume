import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Resume Analyzer",
  description:
    "Upload or paste your resume to get an instant ATS compatibility score, keyword analysis, and actionable improvement suggestions.",
}

export default function AnalyzeLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
