import type { Metadata } from "next"
import Header from "@/components/header"
import Footer from "@/components/footer"

export const metadata: Metadata = {
  title: "Privacy Policy | ResumeIQ",
  description: "How ResumeIQ collects, uses, and protects your data when you analyze resumes and build career documents.",
  alternates: { canonical: "/privacy" },
}

export default function PrivacyPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main id="main-content" className="flex-1 pt-24 pb-20">
        <div className="container mx-auto px-4 max-w-3xl">
          <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground mb-8">Last updated: August 2026</p>

          <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">1. Information We Collect</h2>
              <p>When you use ResumeIQ, we process the resume files and job descriptions you upload or paste in order to generate analyses, suggestions, and career documents. We may also collect basic account and contact information you choose to provide through our contact form.</p>
            </section>
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">2. How We Use Your Information</h2>
              <p>Your documents are used solely to provide the services you request, including ATS scoring, keyword matching, rewriting, cover letter generation, and interview preparation. We do not sell your personal data or documents to third parties.</p>
            </section>
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">3. AI Processing</h2>
              <p>Some features rely on third-party AI providers. Only the content you explicitly submit for a given tool is sent to those providers, and it is used only to generate the requested output.</p>
            </section>
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">4. Data Storage &amp; Retention</h2>
              <p>Uploaded resumes and generated analyses are stored securely in our database so you can revisit your results. You can delete your data at any time from your dashboard, and we honor deletion requests promptly.</p>
            </section>
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">5. Cookies &amp; Sessions</h2>
              <p>We use a browser-stored session identifier so that your uploaded documents remain accessible only to you. We do not use third-party advertising cookies.</p>
            </section>
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">6. Your Rights</h2>
              <p>You may request access to, correction of, or deletion of your personal data at any time by contacting us. You can also stop using the service and delete your documents at any time.</p>
            </section>
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">7. Contact</h2>
              <p>Questions about this policy can be sent to our contact page or directly to ridhyanshtechinfra@gmail.com.</p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
