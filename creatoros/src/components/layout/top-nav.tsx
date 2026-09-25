"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export function TopNav({ userName }: { userName: string }) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/auth/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-navy-100 bg-white/80 px-4 backdrop-blur sm:px-6">
      <div className="text-sm font-medium text-navy-500">
        Welcome back, <span className="font-semibold text-navy-900">{userName}</span>
      </div>
      <div className="flex items-center gap-3">
        <button type="button" onClick={logout} className="btn-secondary !px-3 !py-1.5 text-xs">
          <LogOut className="h-3.5 w-3.5" /> Log out
        </button>
      </div>
    </header>
  );
}