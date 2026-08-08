import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Interview Prep",
  description:
    "Practice with AI-generated interview questions, model answers, and category-filtered prep for your target role.",
  alternates: { canonical: "/interview" },
  openGraph: {
    url: "/interview",
    title: "Interview Prep",
    description:
      "Practice with AI-generated interview questions, model answers, and category-filtered prep for your target role.",
  },
}

export default function InterviewLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
