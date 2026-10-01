import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/get-session";
import { NavLinks, UserMenu } from "@/components/nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login?next=/app");

  return (
    <div className="flex min-h-screen bg-ink-50">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-ink-200 bg-white md:flex">
        <div className="flex h-14 items-center gap-2 border-b border-ink-100 px-4 font-semibold text-ink-900">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">R</span>
          RankPilot AI
        </div>
        <nav className="flex-1 space-y-1 p-3 text-sm">
          <NavLinks />
        </nav>
        <div className="border-t border-ink-100 p-3">
          <UserMenu name={session.user.name} email={session.user.email} role={session.role} plan={session.org.plan} />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-ink-200 bg-white px-4 md:hidden">
          <Link href="/app" className="flex items-center gap-2 font-semibold text-ink-900">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">R</span>
            RankPilot
          </Link>
          <UserMenu name={session.user.name} email={session.user.email} role={session.role} plan={session.org.plan} compact />
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
