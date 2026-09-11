"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { bottomNavItems } from "@/lib/nav";
import { Sheet } from "@/components/ui/sheet";
import { useState } from "react";
import { visibleNavSections } from "@/lib/nav";

export function BottomNav({ permissions }: { permissions: string[] }) {
  const pathname = usePathname();
  const items = bottomNavItems(permissions);
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <>
      <nav
        aria-label="Bottom navigation"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-white lg:hidden"
      >
        <div className="pb-safe grid grid-cols-6">
          {items.slice(0, 5).map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium",
                  active ? "text-[var(--primary)]" : "text-muted-foreground"
                )}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
          <button
            onClick={() => setMoreOpen(true)}
            className="flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium text-muted-foreground"
          >
            <MoreHorizontal className="h-5 w-5" />
            More
          </button>
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen} title="More">
        <nav className="space-y-4" aria-label="More menu">
          {visibleNavSections(permissions).map((section) => (
            <div key={section.title}>
              <p className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {section.title}
              </p>
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setMoreOpen(false)}
                        className="flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-sm hover:bg-zinc-50"
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
        </nav>
      </Sheet>
    </>
  );
}