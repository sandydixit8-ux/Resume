import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Cover Letter Generator",
  description:
    "Generate personalized, ATS-friendly cover letters tailored to any role, company, and tone in seconds.",
  alternates: { canonical: "/cover-letter" },
  openGraph: {
    url: "/cover-letter",
    title: "Cover Letter Generator",
    description:
      "Generate personalized, ATS-friendly cover letters tailored to any role, company, and tone in seconds.",
  },
}

export default function CoverLetterLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
