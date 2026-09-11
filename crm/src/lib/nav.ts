import {
  LayoutDashboard,
  Users,
  Contact2,
  GitBranch,
  CalendarClock,
  PhoneCall,
  Footprints,
  Package,
  Boxes,
  FileText,
  ShoppingCart,
  Truck,
  Receipt,
  Warehouse,
  Megaphone,
  BarChart3,
  Sparkles,
  Bot,
  Settings,
  ShieldCheck,
  ScrollText,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** permission slugs; empty means visible to all authenticated users */
  perms?: string[];
  badge?: (nav: string) => string | null;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const navSections: NavSection[] = [
  {
    title: "Overview",
    items: [
      { label: "Dashboard", href: "/", icon: LayoutDashboard },
      { label: "AI Assistant", href: "/assistant", icon: Bot, perms: ["ai.assistant"] },
      { label: "Reports", href: "/reports", icon: BarChart3, perms: ["report.view"] },
    ],
  },
  {
    title: "CRM",
    items: [
      { label: "Leads", href: "/leads", icon: Users, perms: ["lead.view"] },
      { label: "Pipeline", href: "/pipeline", icon: GitBranch, perms: ["opportunity.view"] },
      { label: "Customers", href: "/customers", icon: Contact2, perms: ["customer.view"] },
      { label: "Tasks & Follow-ups", href: "/tasks", icon: CalendarClock, perms: ["task.view"] },
      { label: "Activities", href: "/activities", icon: PhoneCall, perms: ["activity.view"] },
      { label: "Visits", href: "/visits", icon: Footprints, perms: ["visit.view"] },
    ],
  },
  {
    title: "Sales",
    items: [
      { label: "Quotations", href: "/quotations", icon: FileText, perms: ["quotation.view"] },
      { label: "Orders", href: "/orders", icon: ShoppingCart, perms: ["order.view"] },
      { label: "Deliveries", href: "/deliveries", icon: Truck, perms: ["delivery.view"] },
    ],
  },
  {
    title: "Inventory",
    items: [
      { label: "Products", href: "/products", icon: Package, perms: ["product.view"] },
      { label: "Inventory", href: "/inventory", icon: Boxes, perms: ["inventory.view"] },
      { label: "Stock movements", href: "/stock-movement", icon: ScrollText, perms: ["inventory.view"] },
      { label: "Warehouses", href: "/warehouses", icon: Warehouse, perms: ["inventory.view"] },
    ],
  },
  {
    title: "Finance",
    items: [
      { label: "Invoices", href: "/invoices", icon: Receipt, perms: ["invoice.view"] },
    ],
  },
  {
    title: "Growth",
    items: [
      { label: "Campaigns", href: "/campaigns", icon: Megaphone, perms: ["campaign.view"] },
      { label: "AI Insights", href: "/insights", icon: Sparkles, perms: ["ai.insights"] },
    ],
  },
  {
    title: "Admin",
    items: [
      { label: "Settings", href: "/admin/settings", icon: Settings, perms: ["admin.settings", "admin.users", "admin.roles", "admin.branches", "admin.integrations"] },
      { label: "Audit Log", href: "/admin/audit", icon: ScrollText, perms: ["audit.view"] },
    ],
  },
];

export function visibleNavSections(permissions: string[]): NavSection[] {
  return navSections
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) => !item.perms || item.perms.some((p) => permissions.includes(p))
      ),
    }))
    .filter((section) => section.items.length > 0);
}

/** Mobile bottom navigation: dashboard, leads, customers, tasks, orders, more. */
export function bottomNavItems(permissions: string[]): NavItem[] {
  const all: NavItem[] = [
    { label: "Dashboard", href: "/", icon: LayoutDashboard },
    { label: "Leads", href: "/leads", icon: Users, perms: ["lead.view"] },
    { label: "Customers", href: "/customers", icon: Contact2, perms: ["customer.view"] },
    { label: "Tasks", href: "/tasks", icon: CalendarClock, perms: ["task.view"] },
    { label: "Orders", href: "/orders", icon: ShoppingCart, perms: ["order.view"] },
  ];
  return all.filter((i) => !i.perms || i.perms.some((p) => permissions.includes(p)));
}

export const FAB_ACTIONS: { label: string; href: string; perms?: string[] }[] = [
  { label: "Add Lead", href: "/leads/new", perms: ["lead.create"] },
  { label: "Add Follow-up", href: "/tasks", perms: ["followup.create"] },
  { label: "Log Call", href: "/activities", perms: ["activity.log"] },
  { label: "Add Customer", href: "/customers", perms: ["customer.create"] },
  { label: "Create Visit", href: "/visits", perms: ["visit.create"] },
  { label: "Create Quote", href: "/quotations/new", perms: ["quotation.create"] },
  { label: "Create Order", href: "/orders/new", perms: ["order.create"] },
];