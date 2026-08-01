import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Resume Results",
  description: "Your resume analysis report — ATS score, keyword analysis, and improvement plan.",
  robots: { index: false, follow: false },
}

export default function ResultsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
