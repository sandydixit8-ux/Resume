-- 0002_identity_tenant.sql
-- Organization, branches, users, roles, permissions, invitations.

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text,
  gstin text,
  industry text not null default 'Distribution',
  currency text not null default 'INR',
  timezone text not null default 'Asia/Kolkata',
  logo_url text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','SUSPENDED')),
  plan text not null default 'FREE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  code text,
  address text,
  city text,
  state text,
  pincode text,
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_branches_org on public.branches(organization_id);

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  email text not null,
  full_name text not null,
  phone text,
  avatar_url text,
  org_scope text not null default 'branch' check (org_scope in ('org','branch')),
  is_active boolean not null default true,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_users_org on public.users(organization_id);
create index if not exists idx_users_email on public.users(email);

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  unique (organization_id, slug)
);

create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  slug text not null,
  description text,
  unique (organization_id, slug)
);

create table if not exists public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  primary key (role_id, permission_id)
);

create table if not exists public.user_roles (
  user_id uuid not null references public.users(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  primary key (user_id, role_id)
);

create table if not exists public.user_branches (
  user_id uuid not null references public.users(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  primary key (user_id, branch_id)
);

create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role_slug text not null default 'SALES_EXECUTIVE',
  branch_ids uuid[] not null default '{}',
  token text not null unique,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.organizations enable row level security;
alter table public.branches enable row level security;
alter table public.users enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_roles enable row level security;
alter table public.user_branches enable row level security;
alter table public.invitations enable row level security;

-- organizations
create policy "org_select_self" on public.organizations
  for select using (id = public.current_org_id());
create policy "org_insert_first" on public.organizations
  for insert with check (true);
create policy "org_update_self" on public.organizations
  for update using (id = public.current_org_id());

-- branches
create policy "branch_select" on public.branches
  for select using (
    organization_id = public.current_org_id()
    and public.can_access_branch(id)
  );
create policy "branch_insert" on public.branches
  for insert with check (
    organization_id = public.current_org_id()
    and public.has_permission('admin.branches')
  );
create policy "branch_update" on public.branches
  for update using (
    organization_id = public.current_org_id()
    and public.has_permission('admin.branches')
  );

-- users: a user can always see their own profile; members see users in their scope.
create policy "users_select_self" on public.users
  for select using (id = auth.uid());
create policy "users_select_org" on public.users
  for select using (
    organization_id = public.current_org_id()
    and public.can_access_branch(
      (select branch_id from public.user_branches ub where ub.user_id = public.users.id limit 1))
  );
create policy "users_insert_self" on public.users
  for insert with check (id = auth.uid());
create policy "users_update_self" on public.users
  for update using (id = auth.uid());
create policy "users_update_admin" on public.users
  for update using (
    organization_id = public.current_org_id()
    and public.has_permission('admin.users')
  );

-- roles
create policy "roles_select" on public.roles
  for select using (organization_id = public.current_org_id());
create policy "roles_write" on public.roles
  for all using (
    organization_id = public.current_org_id()
    and public.has_permission('admin.roles')
  );

-- permissions
create policy "permissions_select" on public.permissions
  for select using (organization_id = public.current_org_id());

-- role_permissions / user_roles / user_branches
create policy "role_permissions_select" on public.role_permissions
  for select using (organization_id = public.current_org_id());
create policy "user_roles_select" on public.user_roles
  for select using (organization_id = public.current_org_id());
create policy "user_roles_self" on public.user_roles
  for insert with check (
    user_id = auth.uid()
    and organization_id = public.current_org_id()
  );
create policy "user_branches_select" on public.user_branches
  for select using (organization_id = public.current_org_id());
create policy "user_branches_self" on public.user_branches
  for insert with check (
    user_id = auth.uid()
    and organization_id = public.current_org_id()
  );

-- invitations
create policy "invitations_select" on public.invitations
  for select using (
    organization_id = public.current_org_id()
    and public.has_permission('admin.users')
  );
create policy "invitations_write" on public.invitations
  for all using (
    organization_id = public.current_org_id()
    and public.has_permission('admin.users')
  );