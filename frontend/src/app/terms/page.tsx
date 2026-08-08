import type { Metadata } from "next"
import Header from "@/components/header"
import Footer from "@/components/footer"

export const metadata: Metadata = {
  title: "Terms of Service | ResumeIQ",
  description: "The terms governing your use of ResumeIQ, including acceptable use, disclaimers, and liability.",
  alternates: { canonical: "/terms" },
}

export default function TermsPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main id="main-content" className="flex-1 pt-24 pb-20">
        <div className="container mx-auto px-4 max-w-3xl">
          <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
          <p className="text-sm text-muted-foreground mb-8">Last updated: August 2026</p>

          <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">1. Acceptance of Terms</h2>
              <p>By accessing or using ResumeIQ, you agree to be bound by these Terms of Service. If you do not agree, please do not use the service.</p>
            </section>
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">2. Description of Service</h2>
              <p>ResumeIQ provides AI-assisted resume analysis, keyword matching, rewriting, cover letter generation, resume building, and interview preparation tools.</p>
            </section>
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">3. Acceptable Use</h2>
              <p>You agree not to upload unlawful content, attempt to access another user&apos;s documents, reverse engineer the service, or use the service in any way that could harm the platform or its users.</p>
            </section>
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">4. Intellectual Property</h2>
              <p>You retain ownership of the documents you upload. ResumeIQ and its AI-generated suggestions, templates, and software remain the property of ResumeIQ and its partners.</p>
            </section>
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">5. No Guarantees</h2>
              <p>AI-generated analyses and suggestions are provided on an &ldquo;as is&rdquo; basis. We do not guarantee employment outcomes, interview invitations, or the accuracy of automated scoring.</p>
            </section>
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">6. Limitation of Liability</h2>
              <p>To the maximum extent permitted by law, ResumeIQ shall not be liable for any indirect, incidental, or consequential damages arising from your use of the service.</p>
            </section>
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">7. Changes to These Terms</h2>
              <p>We may update these terms from time to time. Continued use of the service after changes are posted constitutes acceptance of the revised terms.</p>
            </section>
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">8. Contact</h2>
              <p>Questions about these terms can be sent to ridhyanshtechinfra@gmail.com.</p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
