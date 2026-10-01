"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/components/ui";
import { api } from "@/lib/client";

const LINKS: Array<{ href: string; label: string; exact?: boolean }> = [
  { href: "/app", label: "Overview", exact: true },
  { href: "/app/websites", label: "Websites" },
  { href: "/app/studio", label: "Content Studio" },
  { href: "/app/social", label: "Social" },
  { href: "/app/actions", label: "Action Center" },
  { href: "/app/reports", label: "Reports" },
  { href: "/app/copilot", label: "Copilot" },
  { href: "/app/agent", label: "Agent" },
  { href: "/app/settings", label: "Settings" },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <>
      {LINKS.map((l) => {
        const active = l.exact ? pathname === l.href : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={cn(
              "block rounded-lg px-3 py-2 font-medium",
              active ? "bg-brand-50 text-brand-700" : "text-ink-600 hover:bg-ink-50"
            )}
          >
            {l.label}
          </Link>
        );
      })}
    </>
  );
}

export function UserMenu({
  name,
  email,
  role,
  plan,
  compact,
}: {
  name: string;
  email: string;
  role: string;
  plan: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <div className="relative">
      <button
        className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-ink-50"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
          {name.slice(0, 1).toUpperCase()}
        </span>
        {!compact ? (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-ink-800">{name}</span>
            <span className="block truncate text-xs text-ink-400">
              {role} · {plan} plan
            </span>
          </span>
        ) : (
          <span className="text-xs font-medium text-ink-600">{plan}</span>
        )}
      </button>
      {open ? (
        <div className="absolute bottom-full left-0 z-50 mb-1 w-56 rounded-xl border border-ink-200 bg-white p-1 shadow-soft">
          <div className="px-3 py-2 text-xs text-ink-400">{email}</div>
          <Link href="/app/actions" className="block rounded-lg px-3 py-2 text-sm text-ink-700 hover:bg-ink-50">
            Action Center
          </Link>
          <button className="block w-full rounded-lg px-3 py-2 text-left text-sm text-ink-700 hover:bg-ink-50" onClick={logout}>
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
