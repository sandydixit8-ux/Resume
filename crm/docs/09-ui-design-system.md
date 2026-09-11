# I. UI Design System

## Visual direction
- Partition known brand colors only where needed. Primary accent: warm orange
  (`--primary: oklch(0.62 0.20 42)`). Neutrals: white / light gray / dark
  charcoal `#18181b`. Accessible contrast (7d4fa WCAG AA when text, 3:1 for
  large text / UI).
- Orange used sparingly (CTAs, active states, priority HOT). Status color coding:
  - HOT / urgent / overdue: `--destructive`-ish red-orange
  - Success / paid / won: green
  - Info / new: blue
  - Warning / processing: amber
- Density: high info density without clutter; generous whitespace on cards;
  compact tables.

## Typography
- System font stack (Inter via next/font optional). Scale: text-xs .. text-2xl.
- Numeric/tabular for money/order numbers.

## Components (in `src/components/ui`)
- Button (variants: primary, secondary, ghost, outline, destructive;
  sizes: sm, md, lg, icon; loading state)
- Badge / StatusBadge (status -> color mapping registry)
- Card, CardHeader, CardTitle, CardContent
- Input, Select, Textarea, FormField (label + error + hint)
- Dialog / Sheet (drawer) / BottomSheet (mobile)
- Table (server-paginated with header sorting, skeleton rows)
- Tabs, SegmentedControl
- KpiCard (label, value, delta, sparkline)
- SearchInput (debounced), FilterBar
- EmptyState (icon, title, description, action)
- Avatar, Stack, Divider, Skeleton/Spinner
- Toast/Sonner for feedback
- KanbanColumn + KanbanCard
- Timeline (activity feed)
- FAB (mobile), BottomNav, Sidebar, Topbar

## Layout
- Desktop: fixed sidebar (240px) + top header (search, org switcher, avatar,
  notifications) + main scroll area. Max content width ~1280px, card columns.
- Mobile (320-430px): sticky top bar (title + search + avatar), bottom nav with
  5 items (Dashboard, Leads, Customers, Tasks, Orders + More), FAB bottom-right,
  contextual menus via bottom sheet.
- Responsive breakpoints: `sm 640, md 768, lg 1024, xl 1280`.

## States
- Loading: skeleton blocks matching layout.
- Empty: clear empty state with primary action.
- Error: friendly message + retry; technical detail only in dev/console.
- Form validation inline under fields; success toasts.

## Accessibility
- Keyboard navigation, visible focus rings, labels on all inputs, aria
  attributes for dialogs/badges/tab panels, adequate contrast, prefer semantic
  HTML. StatusBadge includes text (not color-only).