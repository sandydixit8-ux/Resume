"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Link2, CalendarCheck, Users, UsersRound, BarChart3, Wand2, Mail, Sparkles, Settings, ShoppingBag, GraduationCap, BookOpen, LayoutTemplate, ShieldCheck } from "lucide-react";

const NAV = [
  { href: "/app", label: "Dashboard", icon: LayoutDashboard },
  { href: "/app/bio", label: "Bio Pages", icon: Link2 },
  { href: "/app/templates", label: "Templates", icon: LayoutTemplate },
  { href: "/app/community", label: "Community", icon: UsersRound },
  { href: "/app/store", label: "Store", icon: ShoppingBag },
  { href: "/app/courses", label: "Courses", icon: GraduationCap },
  { href: "/app/learn", label: "My Learning", icon: BookOpen },
  { href: "/app/leads", label: "Leads", icon: Users },
  { href: "/app/email", label: "Email", icon: Mail },
  { href: "/app/booking", label: "Booking", icon: CalendarCheck },
  { href: "/app/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/app/coach", label: "AI Coach", icon: Wand2 },
  { href: "/app/billing", label: "Billing", icon: Sparkles },
  { href: "/app/settings", label: "Settings", icon: Settings },
];

export function Sidebar({ orgName, plan, isAdmin }: { orgName: string; plan: string; isAdmin: boolean }) {
  const pathname = usePathname();
  const nav = isAdmin ? [...NAV, { href: "/app/admin", label: "Admin", icon: ShieldCheck }] : NAV;

  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-navy-100 bg-white lg:flex">
      <div className="flex h-16 items-center gap-2 border-b border-navy-100 px-5 font-semibold text-navy-900">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">C</span>
        <span>Creator<span className="text-brand-600">OS</span></span>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {nav.map((item) => {
          const active = pathname === item.href || (item.href !== "/app" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                active ? "bg-brand-50 text-brand-700" : "text-navy-600 hover:bg-navy-50 hover:text-navy-900"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-navy-100 p-4">
        <div className="rounded-xl bg-navy-900 p-3 text-white">
          <div className="truncate text-sm font-medium">{orgName}</div>
          <div className="mt-0.5 text-xs capitalize text-white/70">{plan} plan</div>
        </div>
      </div>
    </aside>
  );
}