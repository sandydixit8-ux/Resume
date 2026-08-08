"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Header from "@/components/header"
import Footer from "@/components/footer"
import { Check, ChevronRight, Loader2, AlertCircle, Sparkles } from "lucide-react"
import { getPaymentConfig, createCheckoutSession, getSubscription, createPortalSession } from "@/lib/api"

const plans = [
  {
    name: "Free", price: "₹0", period: "forever", desc: "Perfect for trying things out",
    features: ["3 resume analyses / month", "Basic ATS score", "1 resume template", "1 cover letter / month", "Community support"],
    cta: "Get Started", highlighted: false,
  },
  {
    name: "Pro", price: "₹1,900", period: "per month", desc: "For serious job seekers",
    features: ["Unlimited analyses", "Unlimited resume builder", "Unlimited cover letters", "JD matching", "AI interview prep", "All premium templates", "Priority support"],
    cta: "Start Pro", highlighted: true,
  },
  {
    name: "Recruiter", price: "₹9,900", period: "per month", desc: "For hiring teams",
    features: ["Everything in Pro", "Unlimited job posts", "AI candidate ranking", "Resume comparison", "Analytics dashboard", "Team access (5 seats)", "API access"],
    cta: "Contact Sales", highlighted: false,
  },
]

const planIds: Record<string, string> = { Free: "free", Pro: "pro", Recruiter: "recruiter" }

function formatPrice(amount: number, symbol: string, locale = "en-IN") {
  return `${symbol}${amount.toLocaleString(locale)}`
}

const featureCompare = [
  { feature: "Resume analyses", free: "3/mo", pro: "Unlimited", recruiter: "Unlimited" },
  { feature: "Resume builder", free: "1 template", pro: "Unlimited", recruiter: "Unlimited" },
  { feature: "Cover letters", free: "1/mo", pro: "Unlimited", recruiter: "Unlimited" },
  { feature: "JD matching", free: "\u2014", pro: "\u2713", recruiter: "\u2713" },
  { feature: "AI interview prep", free: "\u2014", pro: "\u2713", recruiter: "\u2713" },
  { feature: "Candidate ranking", free: "\u2014", pro: "\u2014", recruiter: "\u2713" },
  { feature: "Team seats", free: "1", pro: "1", recruiter: "5" },
  { feature: "API access", free: "\u2014", pro: "\u2014", recruiter: "\u2713" },
]

export default function PricingPage() {
  const [email, setEmail] = useState("")
  const [currentPlan, setCurrentPlan] = useState("free")
  const [subStatus, setSubStatus] = useState("inactive")
  const [, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [stripeConfigured, setStripeConfigured] = useState(false)
  const [backendPlans, setBackendPlans] = useState<Record<string, { prices: Record<string, number>; period: string; name: string; features: string[] }> | null>(null)
  const [currency, setCurrency] = useState("INR")
  const [currencySymbols, setCurrencySymbols] = useState<Record<string, string>>({ INR: "₹", USD: "$" })
  const [showEmailPrompt, setShowEmailPrompt] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        const config = await getPaymentConfig()
        setStripeConfigured(config.stripe_configured)
        setBackendPlans(config.plans)
        if (config.currency_symbols) setCurrencySymbols(config.currency_symbols)
        if (config.default_currency) setCurrency(config.default_currency)
        const savedEmail = localStorage.getItem("sub_email")
        if (savedEmail) {
          setEmail(savedEmail)
          const sub = await getSubscription(savedEmail)
          setCurrentPlan(sub.plan)
          setSubStatus(sub.status)
        }
      } catch {} finally { setLoading(false) }
    })()
  }, [])

  const symbol = currencySymbols[currency] || "₹"
  const locale = currency === "USD" ? "en-US" : "en-IN"
  const displayPlans = plans.map((p) => {
    const backend = backendPlans?.[planIds[p.name]]
    if (backend) {
      return {
        ...p,
        price: formatPrice(backend.prices?.[currency] ?? 0, symbol, locale),
        period: backend.period || p.period,
        features: backend.features.length > 0 ? backend.features : p.features,
      }
    }
    return p
  })

  async function handleCheckout(planId: string) {
    if (planId === "free") {
      setCurrentPlan("free")
      setSubStatus("active")
      localStorage.removeItem("sub_email")
      return
    }
    if (planId === "recruiter") {
      window.location.href = "mailto:sales@resumeiq.ai?subject=Recruiter%20Plan%20Inquiry"
      return
    }
    const subEmail = email
    if (!subEmail) {
      setShowEmailPrompt(true)
      setActionLoading(null)
      return
    }
    setActionLoading(planId)
    setError(null)
    try {
      const result = await createCheckoutSession(planId, subEmail, currency)
      localStorage.setItem("sub_email", subEmail)
      if (result.demo) {
        setCurrentPlan("pro")
        setSubStatus("active")
      } else if (result.url) {
        window.location.href = result.url
        return
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed")
    } finally { setActionLoading(null) }
  }

  async function handleManageSubscription() {
    const subEmail = email || localStorage.getItem("sub_email")
    if (!subEmail) return
    setActionLoading("manage")
    try {
      const result = await createPortalSession(subEmail)
      if (result.demo) {
        localStorage.removeItem("sub_email")
        setCurrentPlan("free")
        setSubStatus("inactive")
        setEmail("")
      } else if (result.url) {
        window.location.href = result.url
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open portal")
    } finally { setActionLoading(null) }
  }

  const isActive = subStatus === "active"
  const isPro = currentPlan === "pro" && isActive

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main id="main-content" className="flex-1 pt-24 pb-12">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-4">
              <Badge className="px-4 py-1.5 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 text-emerald-300 border-emerald-500/30 text-sm font-normal">Pricing</Badge>
            </div>
            <div className="text-center mb-16">
              <h1 className="text-3xl md:text-5xl font-bold mb-4">Simple, transparent <span className="text-gradient">pricing</span></h1>
              <p className="text-muted-foreground text-lg max-w-xl mx-auto">
                {stripeConfigured ? "Choose the plan that fits your needs. No hidden fees." : "No API keys needed — demo mode active. Plans work instantly."}
              </p>
              <div className="flex justify-center mt-8">
                <div className="inline-flex rounded-lg border border-border/50 bg-muted/30 p-1" role="group" aria-label="Select currency">
                  {(["INR", "USD"] as const).map((c) => (
                    <button
                      key={c}
                      onClick={() => setCurrency(c)}
                      aria-pressed={currency === c}
                      className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${currency === c ? "bg-gradient-brand text-white glow-brand" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      {c} ({currencySymbols[c] || "₹"})
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {!stripeConfigured && (
              <div className="max-w-md mx-auto mb-8 p-3 bg-emerald-950/20 border border-emerald-800/30 rounded-lg flex items-center gap-2 text-sm">
                <Sparkles className="h-4 w-4 text-emerald-400 shrink-0" />
                <span className="text-emerald-300">Demo mode — signing up creates a local subscription instantly. Set <code className="text-xs bg-emerald-900/30 px-1 rounded">STRIPE_SECRET_KEY</code> for real payments.</span>
              </div>
            )}

            {error && (
              <div className="max-w-md mx-auto mb-8 p-3 bg-red-950/30 border border-red-800/50 rounded-lg flex items-start gap-2 text-sm">
                <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                <span className="text-red-400">{error}</span>
              </div>
            )}

            {showEmailPrompt && (
              <div className="max-w-md mx-auto mb-8 p-5 bg-muted/40 border border-emerald-800/30 rounded-xl" role="dialog" aria-labelledby="email-prompt-title">
                <p id="email-prompt-title" className="font-semibold mb-1">Start the Pro plan</p>
                <p className="text-xs text-muted-foreground mb-3">Enter your email to create your checkout session. We&apos;ll send your subscription details there.</p>
                <form
                  onSubmit={(e) => { e.preventDefault(); setShowEmailPrompt(false); handleCheckout("pro") }}
                  className="space-y-3"
                >
                  <label htmlFor="checkout-email" className="sr-only">Email address</label>
                  <input
                    id="checkout-email"
                    type="email"
                    required
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="flex h-9 w-full rounded-md border border-input bg-background/50 px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                  />
                  <div className="flex gap-2">
                    <Button type="submit" className="flex-1 bg-gradient-brand hover:opacity-90 text-white glow-brand">
                      <ChevronRight className="mr-2 h-4 w-4" /> Continue to Checkout
                    </Button>
                    <Button type="button" variant="outline" className="border-border" onClick={() => setShowEmailPrompt(false)}>Cancel</Button>
                  </div>
                </form>
              </div>
            )}

            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto mb-20">
              {displayPlans.map((p, i) => {
                const isCurrent = isPro && p.name === "Pro"
                return (
                  <Card key={i} className={`relative overflow-hidden border ${p.highlighted ? "border-emerald-500/40 shadow-xl shadow-emerald-500/10 scale-105" : "border-border/50"} bg-transparent hover:border-emerald-500/30 transition-all duration-500`}>
                    {p.highlighted && <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-brand" />}
                    {p.highlighted && <div className="absolute -top-10 -right-10 w-20 h-20 bg-gradient-brand/20 rounded-full blur-2xl" />}
                    <CardHeader>
                      <CardTitle className="text-xl">{p.name}</CardTitle>
                      <div className="mt-2">
                        <span className="text-4xl font-extrabold">{p.price}</span>
                        <span className="text-muted-foreground ml-1 text-sm">/{p.period}</span>
                      </div>
                      <CardDescription className="mt-1">{p.desc}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-3 mb-8">
                        {p.features.map((f, j) => (
                          <li key={j} className="flex items-start gap-3 text-sm">
                            <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                      {isCurrent ? (
                        <div className="space-y-2">
                          <Button disabled className="w-full bg-gradient-brand text-white opacity-90 cursor-default glow-brand">
                            <Check className="mr-2 h-4 w-4" /> Current Plan
                          </Button>
                          <Button variant="outline" className="w-full border-border" onClick={handleManageSubscription} disabled={actionLoading === "manage"}>
                            {actionLoading === "manage" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Manage Subscription
                          </Button>
                        </div>
                      ) : (
                        <Button
                          onClick={() => handleCheckout(p.name.toLowerCase())}
                          disabled={actionLoading !== null || (p.name === "Free" && isActive && currentPlan === "free")}
                          className={`w-full ${p.highlighted ? "bg-gradient-brand hover:opacity-90 text-white glow-brand" : "bg-muted hover:bg-muted/80 text-foreground"}`}
                        >
                          {actionLoading === p.name.toLowerCase() ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</> : <>
                            {p.cta} {p.highlighted && <ChevronRight className="ml-2 h-4 w-4" />}
                          </>}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>

            {isActive && (
              <div className="max-w-md mx-auto mb-12 p-4 bg-emerald-950/20 border border-emerald-800/30 rounded-xl text-center">
                <p className="text-emerald-300 font-medium mb-1">You&apos;re on the <span className="font-bold capitalize">{currentPlan}</span> plan</p>
                <p className="text-xs text-muted-foreground">{email || "No email set"}</p>
              </div>
            )}

            <Card className="border border-border/50 bg-transparent">
              <CardHeader className="text-center">
                <CardTitle className="text-2xl">Feature Comparison</CardTitle>
                <CardDescription>Compare what each plan includes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/50">
                        <th className="text-left py-3 px-4 font-semibold">Feature</th>
                        <th className="text-center py-3 px-4 font-semibold">Free</th>
                        <th className="text-center py-3 px-4 font-semibold text-gradient">Pro</th>
                        <th className="text-center py-3 px-4 font-semibold">Recruiter</th>
                      </tr>
                    </thead>
                    <tbody>
                      {featureCompare.map((f, i) => (
                        <tr key={i} className="border-b border-border/30">
                          <td className="py-3 px-4">{f.feature}</td>
                          <td className="text-center py-3 px-4 text-muted-foreground">{f.free}</td>
                          <td className="text-center py-3 px-4 text-emerald-400">{f.pro}</td>
                          <td className="text-center py-3 px-4 text-cyan-400">{f.recruiter}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
