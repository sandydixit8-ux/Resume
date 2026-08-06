import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Resume Builder",
  description:
    "Build a professional, ATS-friendly resume with multiple templates, live preview, and downloadable HTML output.",
}

export default function BuilderLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
