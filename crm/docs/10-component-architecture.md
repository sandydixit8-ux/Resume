# J. Component Architecture

Next.js App Router. Server components first; client islands for interactive
regions; server actions for mutations.

```
src/
  app/               routes (screens). Server components fetch typed rows.
    (auth)/          login, signup, forgot, verify
    (onboarding)/
    (dashboard)/
      layout.tsx     app shell (sidebar/topbar/bottomnav/FAB)
      page.tsx       dashboard (role-based widgets)
      leads/ [id]/
      ...
  components/
    ui/              design-system primitives (button, card, badgetable, sheets...)
    layout/          sidebar, topbar, bottom-nav, fab, mobile-more-sheet
    feature/         lead/opportunity/customer/task components
      leads/lead-table.tsx             (server data + client sort/paginate)
      leads/lead-card.tsx              (kanban card + mobile card)
      leads/lead-form.tsx              (client form > server action)
      leads/lead-detail.tsx
      pipeline/kanban-board.tsx        (drag-drop = permission + audit)
      dashboard/kpi-grid.tsx
      activities/timeline.tsx
      tasks/followup-list.tsx
    charts/          recharts wrappers (KPI sparkline, donut, bar, line)
  lib/
    supabase/        client.ts (server), browser.ts, middleware client
    auth/            session.ts, permissions.ts, require-role.ts
    data/            typed queries per module (leads.ts, customers.ts...)
    actions/         server actions per module (zod-validated)
    audit.ts         writeAuditLog(...)
    rbac.ts          permission registry + hasPermission
    utils.ts         cx(), formatMoney (INR), date helpers
    scoring.ts       lead scoring algorithm
    tax.ts           GST calculation (cgst/sgst/igst)
    providers/       notification provider abstraction + mocks
  server/            webhooks, jobs (enqueued), ai abstraction
  types/             db.ts (generated), domain.ts
  supabase/migrations/  SQL
```

## Data flow principles
- Server Components query with Supabase SSR client (RLS-enforced).
- Pages pass plain data to client components (`serialize` dates).
- Mutations via server actions, validated with zod, returning
  `{ success, data } | { success:false, error }`.
- Long-running (WhatsApp send, PDF, export, AI) always deferred to a job;
  UI shows queued state.

## Reusability
- Feature components depend only on `lib/data` + `components/ui`.
- UI primitives have no business logic.
- All tables share `DataTable` pagination server-side.