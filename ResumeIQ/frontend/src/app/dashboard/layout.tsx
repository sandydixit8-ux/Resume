import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Your ResumeIQ AI dashboard — resume analyses, downloads, and account overview.",
  alternates: { canonical: "/dashboard" },
  openGraph: {
    url: "/dashboard",
    title: "Dashboard",
    description: "Your ResumeIQ AI dashboard — resume analyses, downloads, and account overview.",
  },
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
