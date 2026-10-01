import Link from "next/link";

const TABS = [
  { href: "/app/settings", label: "Profile", exact: true },
  { href: "/app/settings/usage", label: "Usage & AI cost" },
  { href: "/app/settings/billing", label: "Billing" },
  { href: "/app/settings/members", label: "Members" },
  { href: "/app/settings/clients", label: "Clients" },
  { href: "/app/settings/integrations", label: "Integrations" },
  { href: "/app/settings/branding", label: "Branding" },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">Settings</h1>
      </div>
      <div className="flex flex-wrap gap-1 border-b border-ink-200">
        {TABS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="border-b-2 border-transparent px-3 py-2 text-sm font-medium text-ink-500 hover:text-ink-800"
          >
            {t.label}
          </Link>
        ))}
      </div>
      {children}
    </div>
  );
}
