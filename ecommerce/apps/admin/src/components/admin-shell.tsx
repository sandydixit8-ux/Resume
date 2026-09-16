import Link from "next/link";
import { Badge } from "@nexus/ui";

const nav = [
  { label: "Dashboard", href: "/", phase: 1 },
  { label: "Catalog", href: "/catalog", phase: 2 },
  { label: "Orders", href: "/orders", phase: 3 },
  { label: "Customers", href: "/customers", phase: 3 },
  { label: "Marketing", href: "/marketing", phase: 5 },
  { label: "Inventory", href: "/inventory", phase: 4 },
  { label: "Content", href: "/content", phase: 5 },
  { label: "Reports", href: "/reports", phase: 5 },
  { label: "Settings", href: "/settings", phase: 5 },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-64 shrink-0 border-r border-border bg-card">
        <div className="flex h-16 items-center border-b border-border px-6 text-lg font-bold">
          Nexus Admin
        </div>
        <nav className="space-y-1 p-3" aria-label="Admin navigation">
          {nav.map((item) => (
            <div key={item.label}>
              <Link
                href={item.href}
                className="flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                {item.label}
                <Badge variant="secondary">P{item.phase}</Badge>
              </Link>
            </div>
          ))}
        </nav>
      </aside>
      <main className="flex-1 px-8 py-6">{children}</main>
    </div>
  );
}