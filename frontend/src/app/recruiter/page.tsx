"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Header from "@/components/header"
import Footer from "@/components/footer"
import { Users, Search, BarChart3 } from "lucide-react"
import Link from "next/link"

const features = [
  { icon: Search, title: "AI Candidate Ranking", desc: "Automatically rank candidates against job requirements" },
  { icon: BarChart3, title: "Resume Comparison", desc: "Compare multiple resumes side-by-side with AI insights" },
  { icon: Users, title: "Team Collaboration", desc: "Share candidate profiles and feedback with your team" },
]

export default function RecruiterPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main id="main-content" className="flex-1 pt-24 pb-12">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 text-sm font-medium text-emerald-300 mb-4">
              <Users className="h-3.5 w-3.5" />
              Recruiter Tools
            </div>
            <h1 className="text-3xl md:text-5xl font-bold">Recruiter Tools</h1>
            <p className="mt-3 text-muted-foreground text-lg max-w-2xl mx-auto">
              Streamline your hiring process with AI-powered candidate analysis
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-8">
            {features.map((f, i) => (
              <Card key={i} className="border border-border/50 bg-transparent group hover:border-emerald-500/30 transition-all duration-500">
                <CardHeader>
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center mb-3">
                    <f.icon className="h-5 w-5 text-emerald-400" />
                  </div>
                  <CardTitle className="text-base">{f.title}</CardTitle>
                  <CardDescription className="text-sm">{f.desc}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>

          <Card className="border border-border/50 bg-transparent">
            <CardContent className="text-center py-16">
              <Users className="h-10 w-10 text-muted-foreground/40 mx-auto mb-4" />
              <p className="text-muted-foreground mb-4 text-lg">Enterprise recruiter tools coming soon</p>
              <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                For now, use the resume analyzer and JD matching tools to evaluate candidates.
              </p>
              <div className="flex gap-3 justify-center">
                <Button asChild className="bg-gradient-brand hover:opacity-90 text-white glow-brand">
                  <Link href="/analyze">Analyze Resume</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/jd-match">JD Matching</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  )
}
