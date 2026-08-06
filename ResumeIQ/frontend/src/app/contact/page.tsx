"use client"

import { useState } from "react"
import { Mail, Phone, Clock, Send, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { submitContact } from "@/lib/api"
import Reveal from "@/components/reveal"

const CONTACT_EMAIL = "ridhyanshtechinfra@gmail.com"
const CONTACT_PHONE = "+91 88716 97922"
const CONTACT_PHONE_LINK = "+918871697922"
const BUSINESS_HOURS = "Monday – Saturday | 9:00 AM – 6:00 PM (IST)"

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", company: "", subject: "Sales Inquiry", message: "" })
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [sending, setSending] = useState(false)

  function update(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setSuccess("")
    if (!form.name.trim() || !form.email.trim() || form.message.trim().length < 10) {
      setError("Please fill in your name, email, and a message of at least 10 characters.")
      return
    }
    setSending(true)
    try {
      await submitContact({
        name: form.name,
        email: form.email,
        company: form.company || undefined,
        subject: form.subject || "Sales Inquiry",
        message: form.message,
      })
      setSuccess("Thank you! Your message has been received. We'll get back to you within 1 business day.")
      setForm({ name: "", email: "", company: "", subject: "Sales Inquiry", message: "" })
    } catch {
      setError("Something went wrong. Please try again or email us directly.")
    } finally {
      setSending(false)
    }
  }

  return (
    <main id="main-content" className="pt-24 pb-20 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-cyan-950/5 via-transparent to-emerald-950/5 pointer-events-none" />
      <div className="container mx-auto px-4 relative">
        <Reveal className="text-center mb-4">
          <Badge className="px-4 py-1.5 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 text-emerald-300 border-emerald-500/30 text-sm font-normal">
            Contact Us
          </Badge>
        </Reveal>
        <Reveal delay={1} className="text-center mb-12">
          <h1 className="text-3xl md:text-5xl font-bold mb-4">
            Let&apos;s talk about <span className="text-gradient">growing with ResumeIQ</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Whether you&apos;re a hiring team, recruiter, or individual — tell us what you need and we&apos;ll get back to you.
          </p>
        </Reveal>

        <div className="grid lg:grid-cols-5 gap-8 max-w-6xl mx-auto">
          <Reveal variant="left" className="lg:col-span-2">
          <Card className="border border-border/50 bg-transparent h-full">
            <CardContent className="p-6 space-y-6">
              <div>
                <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
                  <span className="bg-gradient-brand p-1.5 rounded-lg glow-brand">
                    <Mail className="h-4 w-4 text-white" />
                  </span>
                  Email Us
                </h2>
                <a href={`mailto:${CONTACT_EMAIL}`} className="text-muted-foreground hover:text-emerald-400 transition-colors break-all">
                  {CONTACT_EMAIL}
                </a>
                <p className="text-sm text-muted-foreground mt-1">Sales, billing &amp; partnership inquiries</p>
              </div>

              <div className="h-px bg-border/50" />

              <div>
                <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
                  <span className="bg-gradient-cyan p-1.5 rounded-lg glow-cyan">
                    <Phone className="h-4 w-4 text-white" />
                  </span>
                  Call Us
                </h2>
                <a href={`tel:${CONTACT_PHONE_LINK}`} className="text-muted-foreground hover:text-emerald-400 transition-colors">
                  {CONTACT_PHONE}
                </a>
                <p className="text-sm text-muted-foreground mt-1">Direct line to our sales team</p>
              </div>

              <div className="h-px bg-border/50" />

              <div>
                <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
                  <span className="bg-gradient-brand p-1.5 rounded-lg glow-brand">
                    <Clock className="h-4 w-4 text-white" />
                  </span>
                  Business Hours
                </h2>
                <p className="text-muted-foreground">{BUSINESS_HOURS}</p>
                <p className="text-sm text-muted-foreground mt-1">We reply to all messages within 1 business day.</p>
              </div>
            </CardContent>
          </Card>
          </Reveal>

          <Reveal variant="right" className="lg:col-span-3">
          <Card className="border border-border/50 bg-transparent h-full">
            <CardContent className="p-6 md:p-8">
              <h2 className="text-xl font-bold mb-1">Send us a message</h2>
              <p className="text-sm text-muted-foreground mb-6">Use this form for sales inquiries, team licenses, and demos.</p>

              <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium mb-1.5">Name *</label>
                    <Input id="name" value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Your name" required />
                  </div>
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium mb-1.5">Email *</label>
                    <Input id="email" type="email" value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="you@company.com" required />
                  </div>
                </div>

                <div>
                  <label htmlFor="company" className="block text-sm font-medium mb-1.5">Company <span className="text-muted-foreground font-normal">(optional)</span></label>
                  <Input id="company" value={form.company} onChange={(e) => update("company", e.target.value)} placeholder="Your company name" />
                </div>

                <div>
                  <label htmlFor="subject" className="block text-sm font-medium mb-1.5">Subject</label>
                  <Input id="subject" value={form.subject} onChange={(e) => update("subject", e.target.value)} placeholder="Sales Inquiry" />
                </div>

                <div>
                  <label htmlFor="message" className="block text-sm font-medium mb-1.5">Message *</label>
                  <Textarea id="message" value={form.message} onChange={(e) => update("message", e.target.value)} placeholder="Tell us about your requirements..." className="min-h-[140px]" required />
                </div>

                {error && <p className="text-sm text-red-400">{error}</p>}
                {success && (
                  <div className="flex items-start gap-2 rounded-lg bg-emerald-900/30 border border-emerald-500/30 p-3 text-sm text-emerald-300">
                    <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{success}</span>
                  </div>
                )}

                <Button type="submit" disabled={sending} className="bg-gradient-brand hover:opacity-90 text-white glow-brand w-full sm:w-auto">
                  <Send className="mr-2 h-4 w-4" /> {sending ? "Sending..." : "Send Message"}
                </Button>
              </form>
            </CardContent>
          </Card>
          </Reveal>
        </div>
      </div>
    </main>
  )
}
