-- 0005_comms_automation_audit.sql
-- Communication, marketing, notifications, automation, audit log, documents,
-- webhooks, platform billing.

create table if not exists public.message_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  channel text not null default 'whatsapp' check (channel in ('whatsapp','email','sms')),
  category text,
  body text not null,
  variables text[] not null default '{}',
  approval_status text not null default 'PENDING' check (approval_status in ('PENDING','APPROVED','REJECTED')),
  is_active boolean not null default true,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  entity_type text,
  entity_id uuid,
  direction text not null check (direction in ('in','out')),
  channel text not null check (channel in ('whatsapp','email','sms','push')),
  provider text not null default 'mock',
  recipient text,
  body text not null,
  template_id uuid references public.message_templates(id) on delete set null,
  status text not null default 'QUEUED' check (status in ('QUEUED','SENT','DELIVERED','READ','FAILED')),
  provider_ref text,
  error text,
  sent_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  channel text not null default 'whatsapp',
  template_id uuid references public.message_templates(id) on delete set null,
  segment jsonb not null default '{}',
  schedule_at timestamptz,
  status text not null default 'DRAFT' check (status in ('DRAFT','SCHEDULED','SENDING','SENT','CANCELLED')),
  metrics jsonb not null default '{}',
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  recipient_type text not null check (recipient_type in ('customer','lead')),
  recipient_id uuid not null,
  consent boolean not null default false,
  status text not null default 'PENDING',
  message_id uuid references public.messages(id) on delete set null
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  category text not null default 'System' check (category in ('Lead','Followup','Order','Payment','Inventory','Delivery','System','Approval')),
  title text not null,
  body text,
  link text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_notifications_user_read on public.notifications(user_id, is_read, created_at);

create table if not exists public.notification_preferences (
  user_id uuid not null references public.users(id) on delete cascade,
  channel text not null check (channel in ('inapp','push','email','whatsapp')),
  category text not null,
  enabled boolean not null default true,
  primary key (user_id, channel, category)
);

create table if not exists public.automations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  trigger_type text not null,
  trigger_config jsonb not null default '{}',
  conditions jsonb not null default '[]',
  actions jsonb not null default '[]',
  last_run_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  automation_id uuid references public.automations(id) on delete cascade,
  entity_type text,
  entity_id uuid,
  ran_at timestamptz not null default now(),
  success boolean not null default true,
  error text
);

create table if not exists public.ai_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  job_type text not null check (job_type in ('assistant','scoring','catalogue','insights')),
  input jsonb not null default '{}',
  output jsonb,
  status text not null default 'PENDING' check (status in ('PENDING','RUNNING','DONE','FAILED')),
  error text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  entity_type text,
  entity_id uuid,
  name text not null,
  storage_path text not null,
  mime text,
  size int,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  user_id uuid references public.users(id) on delete set null,
  action text not null,
  entity text not null,
  entity_id uuid,
  old_value jsonb,
  new_value jsonb,
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists idx_audit_org on public.audit_logs(organization_id, created_at);

create table if not exists public.webhooks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  url text not null,
  secret text,
  events text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.webhook_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  webhook_id uuid references public.webhooks(id) on delete set null,
  event text,
  payload jsonb,
  attempt int not null default 1,
  status_code int,
  response text,
  success boolean not null default false,
  idempotency_key text,
  created_at timestamptz not null default now()
);

-- Platform billing
create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  price numeric not null default 0,
  limits jsonb not null default '{}'
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  plan_id uuid references public.plans(id),
  status text not null default 'TRIAL' check (status in ('TRIAL','ACTIVE','PAST_DUE','CANCELLED')),
  started_at timestamptz not null default now(),
  renew_at timestamptz,
  entitlements jsonb not null default '{}',
  unique (organization_id)
);

create table if not exists public.feature_flags (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  slug text not null,
  enabled boolean not null default false,
  unique (organization_id, slug)
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.message_templates enable row level security;
alter table public.messages enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_recipients enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.automations enable row level security;
alter table public.automation_runs enable row level security;
alter table public.ai_jobs enable row level security;
alter table public.documents enable row level security;
alter table public.audit_logs enable row level security;
alter table public.webhooks enable row level security;
alter table public.webhook_logs enable row level security;
alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.feature_flags enable row level security;

create policy "message_templates_all" on public.message_templates for all using (organization_id = public.current_org_id());
create policy "messages_all" on public.messages for all using (organization_id = public.current_org_id());
create policy "campaigns_all" on public.campaigns for all using (organization_id = public.current_org_id());
create policy "campaign_recipients_all" on public.campaign_recipients for all using (organization_id = public.current_org_id());

-- Notifications: scoped to the individual user.
create policy "notifications_self" on public.notifications for all using (
  user_id = auth.uid() or public.has_permission(array['notification.view'])
) with check (user_id = auth.uid());

create policy "notification_prefs_self" on public.notification_preferences for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "automations_select" on public.automations for select using (organization_id = public.current_org_id());
create policy "automations_write" on public.automations for all using (organization_id = public.current_org_id() and public.has_permission('automation.edit'));
create policy "automation_runs_all" on public.automation_runs for all using (organization_id = public.current_org_id());
create policy "ai_jobs_self" on public.ai_jobs for all using (
  organization_id = public.current_org_id() and created_by = auth.uid()
);
create policy "documents_all" on public.documents for all using (organization_id = public.current_org_id());

-- Audit logs: selectable by admins/owners only, never mutable in-app.
create policy "audit_select" on public.audit_logs for select using (
  organization_id = public.current_org_id()
  and public.has_permission(array['audit.view'])
);
create policy "audit_insert" on public.audit_logs for insert with check (organization_id = public.current_org_id());

create policy "webhooks_select" on public.webhooks for select using (organization_id = public.current_org_id());
create policy "webhooks_write" on public.webhooks for all using (organization_id = public.current_org_id() and public.has_permission('admin.integrations'));
create policy "webhook_logs_select" on public.webhook_logs for select using (organization_id = public.current_org_id());

create policy "plans_select" on public.plans for select using (true);
create policy "subscriptions_select" on public.subscriptions for select using (organization_id = public.current_org_id());
create policy "subscriptions_write" on public.subscriptions for all using (organization_id = public.current_org_id() and public.has_permission('admin.subscription'));
create policy "feature_flags_select" on public.feature_flags for select using (organization_id = public.current_org_id());