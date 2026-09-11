-- 0003_crm_tables.sql
-- Pipeline, leads, customers, opportunities, activities, tasks, follow-ups,
-- visits, attendance. Every table RLS-enforced at tenant + branch scope.
-- Ownership scoping (own vs team) is enforced in the application query layer.

create table if not exists public.lead_sources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null
);

create table if not exists public.pipelines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  pipeline_id uuid not null references public.pipelines(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  probability numeric not null default 0 check (probability between 0 and 100),
  expected_days int not null default 0,
  sort_order int not null default 0,
  is_winning boolean not null default false,
  is_losing boolean not null default false
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  lead_no text not null,
  name text not null,
  company text,
  contact_person text,
  mobile text,
  alt_mobile text,
  email text,
  whatsapp_number text,
  address text,
  city text,
  state text,
  pincode text,
  source text not null default 'Manual Entry',
  campaign text,
  product_interest text,
  value numeric not null default 0,
  score int not null default 0 check (score between 0 and 100),
  priority text not null default 'COLD' check (priority in ('HOT','WARM','COLD')),
  status text not null default 'NEW' check (status in ('NEW','CONTACTED','QUALIFIED','PROPOSAL','NEGOTIATION','WON','LOST','NURTURE')),
  owner_id uuid references public.users(id) on delete set null,
  last_contacted_at timestamptz,
  next_followup_at timestamptz,
  notes text,
  tags text[] not null default '{}',
  converted_customer_id uuid,
  merged_into_id uuid references public.leads(id) on delete set null,
  is_deleted boolean not null default false,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_leads_org_status on public.leads(organization_id, status);
create index if not exists idx_leads_org_created on public.leads(organization_id, created_at);
create index if not exists idx_leads_owner on public.leads(owner_id);
create index if not exists idx_leads_mobile on public.leads(mobile);
create index if not exists idx_leads_name_trgm on public.leads using gin (name gin_trgm_ops);
create index if not exists idx_leads_email on public.leads(email);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  customer_no text not null,
  name text not null,
  company text,
  category text,
  mobile text,
  email text,
  whatsapp_number text,
  address text,
  city text,
  state text,
  pincode text,
  gstin text,
  credit_limit numeric not null default 0,
  opt_in_comms boolean not null default true,
  tags text[] not null default '{}',
  assigned_to uuid references public.users(id) on delete set null,
  is_deleted boolean not null default false,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_customers_org on public.customers(organization_id);
create index if not exists idx_customers_mobile on public.customers(mobile);
create index if not exists idx_customers_name_trgm on public.customers using gin (name gin_trgm_ops);

create table if not exists public.customer_contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  name text not null,
  mobile text,
  email text,
  designation text
);

create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  pipeline_id uuid not null references public.pipelines(id) on delete cascade,
  stage_id uuid not null references public.pipeline_stages(id),
  name text not null,
  value numeric not null default 0,
  probability numeric not null default 0,
  expected_close_date date,
  owner_id uuid references public.users(id) on delete set null,
  next_action_at timestamptz,
  last_activity_at timestamptz,
  status text not null default 'OPEN' check (status in ('OPEN','WON','LOST')),
  closed_at timestamptz,
  lost_reason text,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_opps_org_stage on public.opportunities(organization_id, stage_id);
create index if not exists idx_opps_owner on public.opportunities(owner_id);

-- Unified activity/timeline log (calls, whatsapp, email, meetings, visits,
-- notes, tasks, system events) for leads, customers, opportunities, orders.
create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  entity_type text not null check (entity_type in ('lead','customer','opportunity','order','quotation','invoice','delivery','task','followup','visit')),
  entity_id uuid,
  activity_type text not null check (activity_type in ('call','whatsapp','email','meeting','visit','note','task','system','quote','order','payment','delivery')),
  direction text check (direction in ('in','out')),
  summary text not null,
  meta jsonb not null default '{}',
  performed_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null
);
create index if not exists idx_activities_entity on public.activities(entity_type, entity_id);
create index if not exists idx_activities_org on public.activities(organization_id, performed_at);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  owner_id uuid references public.users(id) on delete set null,
  subject text not null,
  description text,
  due_at timestamptz,
  priority text not null default 'NORMAL' check (priority in ('HIGH','NORMAL','LOW')),
  status text not null default 'TODO' check (status in ('TODO','IN_PROGRESS','DONE','CANCELLED')),
  entity_type text,
  entity_id uuid,
  completed_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_tasks_owner_due on public.tasks(owner_id, due_at);
create index if not exists idx_tasks_org_status on public.tasks(organization_id, status);

create table if not exists public.followups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  entity_type text not null check (entity_type in ('lead','customer','opportunity')),
  entity_id uuid not null,
  kind text not null default 'call' check (kind in ('call','whatsapp','meeting','visit','email','task','custom')),
  subject text not null,
  due_at timestamptz not null,
  remind_at timestamptz,
  recurring_interval text check (recurring_interval in ('daily','weekly','monthly')) ,
  status text not null default 'PENDING' check (status in ('PENDING','DONE','SKIPPED','CANCELLED')),
  completed_at timestamptz,
  context text,
  note text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_followups_org_due on public.followups(organization_id, due_at);
create index if not exists idx_followups_entity on public.followups(entity_type, entity_id);

create table if not exists public.visits (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  visit_by uuid references public.users(id) on delete set null,
  status text not null default 'PLANNED' check (status in ('PLANNED','STARTED','COMPLETED','MISSED','CANCELLED')),
  purpose text not null,
  scheduled_at timestamptz not null,
  check_in_at timestamptz,
  check_out_at timestamptz,
  lat numeric,
  lng numeric,
  notes text,
  outcome text,
  photos jsonb not null default '[]',
  next_visit_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_visits_org_status on public.visits(organization_id, status, scheduled_at);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  date date not null default current_date,
  check_in_at timestamptz,
  check_out_at timestamptz,
  check_in_lat numeric,
  check_in_lng numeric,
  status text not null default 'PRESENT' check (status in ('PRESENT','ABSENT','LATE','ON_LEAVE','FIELD_VISIT')),
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.lead_sources enable row level security;
alter table public.pipelines enable row level security;
alter table public.pipeline_stages enable row level security;
alter table public.leads enable row level security;
alter table public.customers enable row level security;
alter table public.customer_contacts enable row level security;
alter table public.opportunities enable row level security;
alter table public.activities enable row level security;
alter table public.tasks enable row level security;
alter table public.followups enable row level security;
alter table public.visits enable row level security;
alter table public.attendance enable row level security;

-- Generic tenant+branch policy shape used below:
--   organization_id = public.current_org_id()
--   and public.can_access_branch(branch_id)

create policy "lead_sources_select" on public.lead_sources for select using (organization_id = public.current_org_id());
create policy "lead_sources_write" on public.lead_sources for all using (organization_id = public.current_org_id());

create policy "pipelines_select" on public.pipelines for select using (organization_id = public.current_org_id());
create policy "pipelines_write" on public.pipelines for all using (organization_id = public.current_org_id() and public.has_permission('admin.settings'));

create policy "pipeline_stages_select" on public.pipeline_stages for select using (organization_id = public.current_org_id());
create policy "pipeline_stages_write" on public.pipeline_stages for all using (organization_id = public.current_org_id());

create policy "leads_all" on public.leads for all using (
  organization_id = public.current_org_id() and public.can_access_branch(branch_id)
) with check (
  organization_id = public.current_org_id() and public.can_access_branch(branch_id)
  and public.has_permission('lead.create')
);

create policy "customers_all" on public.customers for all using (
  organization_id = public.current_org_id() and public.can_access_branch(branch_id)
) with check (
  organization_id = public.current_org_id() and public.can_access_branch(branch_id)
);

create policy "customer_contacts_all" on public.customer_contacts for all using (organization_id = public.current_org_id());

create policy "opportunities_all" on public.opportunities for all using (
  organization_id = public.current_org_id() and public.can_access_branch(branch_id)
) with check (
  organization_id = public.current_org_id() and public.can_access_branch(branch_id)
);

create policy "activities_all" on public.activities for all using (
  organization_id = public.current_org_id() and public.can_access_branch(branch_id)
) with check (
  organization_id = public.current_org_id() and public.can_access_branch(branch_id)
);

create policy "tasks_all" on public.tasks for all using (
  organization_id = public.current_org_id()
) with check (organization_id = public.current_org_id());

create policy "followups_all" on public.followups for all using (
  organization_id = public.current_org_id() and public.can_access_branch(branch_id)
) with check (
  organization_id = public.current_org_id() and public.can_access_branch(branch_id)
);

create policy "visits_all" on public.visits for all using (
  organization_id = public.current_org_id() and public.can_access_branch(branch_id)
) with check (
  organization_id = public.current_org_id() and public.can_access_branch(branch_id)
);

create policy "attendance_self" on public.attendance using (user_id = auth.uid());
create policy "attendance_org" on public.attendance for select using (
  organization_id = public.current_org_id() and public.has_permission('attendance.view')
);