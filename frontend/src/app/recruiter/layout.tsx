import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Recruiter Tools",
  description:
    "Hiring tools for recruiters and teams — job posts, AI candidate ranking, and resume comparison.",
  alternates: { canonical: "/recruiter" },
  openGraph: {
    url: "/recruiter",
    title: "Recruiter Tools",
    description:
      "Hiring tools for recruiters and teams — job posts, AI candidate ranking, and resume comparison.",
  },
}

export default function RecruiterLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
