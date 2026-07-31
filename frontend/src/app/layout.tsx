import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
})

export const metadata: Metadata = {
  title: "ResumeIQ AI — Analyze. Optimize. Get Hired.",
  description:
    "AI-powered resume analysis, ATS scoring, JD matching, cover letter generation, and interview prep. Land your dream job faster with ResumeIQ AI.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${inter.variable} dark h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        <VisitorTracker />
      </body>
    </html>
  )
}

import VisitorTracker from "@/components/visitor-tracker"
