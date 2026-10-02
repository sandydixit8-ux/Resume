import Link from "next/link";
import { SiteFooter } from "@/components/layout/site-footer";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-40 border-b border-navy-100 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold text-navy-900">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">C</span>
            <span>Creator<span className="text-brand-600">OS</span></span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/auth/login" className="text-sm font-medium text-navy-700 hover:text-navy-900">Log in</Link>
            <Link href="/auth/register" className="btn-primary">Get started free</Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-16">{children}</main>

      <SiteFooter />
    </div>
  );
}
