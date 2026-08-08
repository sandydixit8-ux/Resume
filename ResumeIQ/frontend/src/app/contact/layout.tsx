import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Contact Us",
  description:
    "Contact ResumeIQ AI — sales inquiries, support, and feedback. We typically respond within one business day.",
  alternates: { canonical: "/contact" },
  openGraph: {
    url: "/contact",
    title: "Contact Us",
    description:
      "Contact ResumeIQ AI — sales inquiries, support, and feedback. We typically respond within one business day.",
  },
}

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
