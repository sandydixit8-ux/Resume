import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
})

const siteUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || "http://localhost:3000"

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "ResumeIQ AI — Analyze. Optimize. Get Hired.",
    template: "%s | ResumeIQ AI",
  },
  description:
    "AI-powered resume analysis, ATS scoring, JD matching, cover letter generation, and interview prep. Land your dream job faster with ResumeIQ AI.",
  applicationName: "ResumeIQ AI",
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: "ResumeIQ AI",
    title: "ResumeIQ AI — Analyze. Optimize. Get Hired.",
    description:
      "AI-powered resume analysis, ATS scoring, JD matching, cover letter generation, and interview prep.",
  },
  twitter: {
    card: "summary_large_image",
    title: "ResumeIQ AI — Analyze. Optimize. Get Hired.",
    description:
      "AI-powered resume analysis, ATS scoring, JD matching, cover letter generation, and interview prep.",
  },
  alternates: { canonical: "/" },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${inter.variable} dark h-full antialiased`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: "document.documentElement.classList.add('js');",
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-md focus:bg-primary focus:text-primary-foreground focus:text-sm"
        >
          Skip to content
        </a>
        {children}
        <VisitorTracker />
      </body>
    </html>
  )
}

import VisitorTracker from "@/components/visitor-tracker"
