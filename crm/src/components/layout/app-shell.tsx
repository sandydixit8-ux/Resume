"use client";

import { usePathname } from "next/navigation";
import { Bell, Search } from "lucide-react";
import { MobileMenu, Sidebar } from "@/components/layout/sidebar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { Fab } from "@/components/layout/fab";
import { visibleNavSections } from "@/lib/nav";
import { Toaster } from "@/components/ui/toast";

export interface ShellContextData {
  orgName: string;
  userName: string;
  permissions: string[];
  unreadNotifications: number;
}

const TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/leads": "Leads",
  "/pipeline": "Sales Pipeline",
  "/customers": "Customers",
  "/tasks": "Tasks & Follow-ups",
  "/activities": "Activities",
  "/visits": "Field Visits",
  "/quotations": "Quotations",
  "/orders": "Orders",
  "/deliveries": "Deliveries",
  "/products": "Products",
  "/inventory": "Inventory",
  "/invoices": "Invoices",
  "/campaigns": "Campaigns",
  "/reports": "Reports",
  "/assistant": "AI Assistant",
  "/insights": "AI Insights",
  "/admin/settings": "Settings",
  "/admin/audit": "Audit Log",
};

export function AppShell({ children, data }: { children: React.ReactNode; data: ShellContextData }) {
  const pathname = usePathname();

  const title =
    TITLES[pathname] ??
    (pathname.startsWith("/leads/")
      ? "Lead"
      : pathname.startsWith("/customers/")
        ? "Customer"
        : pathname.startsWith("/products/")
          ? "Product"
          : pathname.startsWith("/quotations/")
            ? "Quotation"
            : pathname.startsWith("/orders/")
              ? "Order"
              : pathname.startsWith("/invoices/")
                ? "Invoice"
                : "VyaparOne");

  const sections = visibleNavSections(data.permissions);

  async function handleLogout() {
    const res = await fetch("/api/auth/logout", { method: "POST" });
    if (res.ok) {
      window.location.assign("/login");
    }
  }

  return (
    <div className="min-h-dvh">
      <Sidebar sections={sections} orgName={data.orgName} userName={data.userName} onLogout={handleLogout} />

      <div className="flex min-h-dvh flex-col lg:pl-60">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-[var(--border)] bg-white/90 px-3 backdrop-blur lg:px-6">
          <MobileMenu sections={sections} userName={data.userName} />
          <h1 className="flex-1 truncate text-sm font-semibold lg:hidden">{title}</h1>
          <div className="ml-auto hidden flex-1 lg:block" />
          <a
            href="/search"
            className="hidden items-center gap-2 rounded-lg border border-[var(--border)] bg-zinc-50 px-3 py-1.5 text-xs text-muted-foreground hover:bg-zinc-100 lg:flex"
          >
            <Search className="h-3.5 w-3.5" />
            Search customers, leads, orders…
          </a>
          <a
            href="/notifications"
            aria-label={`Notifications${data.unreadNotifications ? `, ${data.unreadNotifications} unread` : ""}`}
            className="relative rounded-md p-2 text-muted-foreground hover:bg-zinc-100 hover:text-foreground"
          >
            <Bell className="h-5 w-5" />
            {data.unreadNotifications > 0 ? (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--destructive)] px-1 text-[9px] font-bold text-white">
                {data.unreadNotifications > 9 ? "9+" : data.unreadNotifications}
              </span>
            ) : null}
          </a>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-3 py-4 pb-28 lg:px-6 lg:pb-10">
          {children}
        </main>
      </div>

      <BottomNav permissions={data.permissions} />
      <Fab permissions={data.permissions} />
      <Toaster />
    </div>
  );
}