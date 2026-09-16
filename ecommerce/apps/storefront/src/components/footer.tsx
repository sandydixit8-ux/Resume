import Link from "next/link";

const links = {
  Company: [
    { label: "About Us", href: "/about" },
    { label: "Contact", href: "/contact" },
    { label: "Help Center", href: "/help" },
    { label: "FAQ", href: "/faq" },
  ],
  Policies: [
    { label: "Privacy Policy", href: "/privacy-policy" },
    { label: "Terms & Conditions", href: "/terms" },
    { label: "Return Policy", href: "/return-policy" },
    { label: "Shipping Policy", href: "/shipping-policy" },
  ],
};

export function Footer() {
  return (
    <footer className="border-t border-border bg-muted/40">
      <div className="container-page grid gap-8 py-10 sm:grid-cols-3">
        <div>
          <p className="text-lg font-bold">Nexus</p>
          <p className="mt-2 max-w-xs text-sm text-muted-foreground">
            One destination to discover, compare and buy across categories.
          </p>
        </div>
        {Object.entries(links).map(([heading, items]) => (
          <nav key={heading} aria-label={heading}>
            <p className="text-sm font-semibold">{heading}</p>
            <ul className="mt-3 space-y-2">
              {items.map((linkItem) => (
                <li key={linkItem.href}>
                  <Link
                    href={linkItem.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {linkItem.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-border py-4">
        <p className="container-page text-center text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} Nexus. All rights reserved.
        </p>
      </div>
    </footer>
  );
}