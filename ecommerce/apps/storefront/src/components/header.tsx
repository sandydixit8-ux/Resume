import Link from "next/link";
import { Button } from "@nexus/ui";
import { CartBadge } from "@/components/cart-badge";

const navItems = [
  { label: "All Products", href: "/products" },
  { label: "Deals", href: "/deals" },
  { label: "New Arrivals", href: "/new-arrivals" },
  { label: "Best Sellers", href: "/best-sellers" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background">
      <div className="bg-primary px-4 py-1.5 text-center text-xs font-medium text-primary-foreground">
        Free shipping on orders above &#8377;499 · Easy 7-day returns
      </div>
      <div className="container-page flex h-16 items-center gap-4">
        <Link href="/" className="shrink-0 text-xl font-bold tracking-tight">
          Nexus
        </Link>
        <form action="/search" className="hidden flex-1 sm:block">
          <div className="relative">
            <label htmlFor="site-search" className="sr-only">
              Search products
            </label>
            <input
              id="site-search"
              type="search"
              name="q"
              placeholder="Search for products, brands and more"
              className="h-10 w-full rounded-md border border-input bg-background px-3 pr-12 text-sm"
              autoComplete="off"
            />
            <Button type="submit" size="sm" className="absolute right-1 top-1">
              Search
            </Button>
          </div>
        </form>
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2 sm:ml-0">
          <Link href="/login">
            <Button variant="ghost" size="sm">
              Account
            </Button>
          </Link>
          <Link href="/account/orders">
            <Button variant="ghost" size="sm">
              Orders
            </Button>
          </Link>
          <CartBadge />
        </div>
      </div>
    </header>
  );
}