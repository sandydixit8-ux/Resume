import Link from "next/link";
import { requireGuest } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  await requireGuest();
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-[#f7f7f8] px-4 py-10">
      <div className="mb-6 flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--primary)] text-lg font-bold text-white">
          V
        </span>
        <span className="text-lg font-semibold">VyaparOne CRM</span>
      </div>
      <div className="w-full max-w-sm">
        {children}
        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Link href="/" className="hover:underline">
            VyaparOne
          </Link>{" "}
          · Mobile-first CRM for Indian SMBs
        </p>
      </div>
    </div>
  );
}