import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Simple, transparent pricing. Choose the plan that fits your needs — Free, Pro, or Recruiter.",
}

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
