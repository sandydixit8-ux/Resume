"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu, X, HelpCircle } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { type NavSection } from "@/lib/nav";
import { Avatar } from "@/components/ui/avatar";
import { Sheet } from "@/components/ui/sheet";

/** Desktop sidebar (fixed left). */
export function Sidebar({
  sections,
  orgName,
  userName,
  onLogout,
}: {
  sections: NavSection[];
  orgName: string;
  userName: string;
  onLogout: () => void;
}) {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-[var(--border)] bg-white lg:flex">
      <div className="flex h-14 items-center gap-2 border-b border-[var(--border)] px-4">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--primary)] text-sm font-bold text-white">
          V
        </span>
        <span className="text-sm font-semibold">VyaparOne</span>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Sidebar">
        {sections.map((section) => (
          <div key={section.title} className="mb-3">
            <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {section.title}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active =
                  item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
                        active
                          ? "bg-orange-50 font-medium text-[var(--primary)]"
                          : "text-foreground/80 hover:bg-zinc-50"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-[var(--border)] p-3">
        <div className="flex items-center gap-2.5">
          <Avatar name={userName} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium">{userName}</p>
            <p className="truncate text-[11px] text-muted-foreground">{orgName}</p>
          </div>
          <button
            onClick={onLogout}
            aria-label="Sign out"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-zinc-100 hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}

/** Mobile hamburger + full-screen navigation sheet. */
export function MobileMenu({
  sections,
  userName,
}: {
  sections: NavSection[];
  userName: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Open navigation menu"
        className="rounded-md p-1.5 lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      <Sheet open={open} onOpenChange={setOpen} title={`Hi, ${userName}`}>
        <nav className="space-y-4" aria-label="Mobile navigation">
          {sections.map((section) => (
            <div key={section.title}>
              <p className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {section.title}
              </p>
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const active = pathname.startsWith(item.href);
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-sm",
                          active
                            ? "bg-orange-50 font-medium text-[var(--primary)]"
                            : "hover:bg-zinc-50"
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          <div className="flex items-center gap-2 px-1 pt-2 text-muted-foreground">
            <HelpCircle className="h-4 w-4" />
            <span className="text-xs">Need help? Contact support</span>
          </div>
        </nav>
      </Sheet>
    </>
  );
}