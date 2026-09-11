import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  await requireUser();

  return (
    <div className="min-h-dvh bg-[#f7f7f8]">
      <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--primary)] text-sm font-bold text-white">
              V
            </span>
            <span className="text-sm font-semibold">Set up your business</span>
          </div>
          <span className="text-xs text-muted-foreground">Free trial</span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl px-4 py-8">{children}</main>
    </div>
  );
}