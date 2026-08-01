import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "JD Matching",
  description:
    "Compare your resume against any job description and get a detailed match score with actionable insights.",
}

export default function JdMatchLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
