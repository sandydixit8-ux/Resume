-- 0001_extensions_and_helpers.sql
-- Extensions, RLS helper functions used by all tenant tables below.

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;
create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------------
-- RLS helper functions (security definer, read only the CALLER's own scope)
-- ---------------------------------------------------------------------------

-- The organization_id of the currently authenticated user (null when none).
create or replace function public.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select u.organization_id
  from public.users u
  where u.id = auth.uid();
$$;

-- 'org'  -> user has organization-wide access (owner/admin/accountant)
-- 'branch' -> user is scoped to the branches in user_branches
create or replace function public.user_org_scope()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(u.org_scope, 'branch')
  from public.users u
  where u.id = auth.uid();
$$;

create or replace function public.user_accessible_branch_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(ub.branch_id), '{}')
  from public.user_branches ub
  where ub.user_id = auth.uid();
$$;

-- True when the caller may see rows belonging to the given branch (or org-level rows).
create or replace function public.can_access_branch(p_branch uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_branch is null
    or public.user_org_scope() = 'org'
    or p_branch = any(public.user_accessible_branch_ids());
$$;

-- True when the caller has any of the given permission slugs.
create or replace function public.has_permission(perm_slugs text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.role_permissions rp on rp.role_id = ur.role_id
    join public.permissions p on p.id = rp.permission_id
    where ur.user_id = auth.uid()
      and p.slug = any(perm_slugs)
  );
$$;

-- Convenience single-slug variant
create or replace function public.has_permission(perm_slug text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_permission(array[perm_slug]);
$$;

-- ---------------------------------------------------------------------------
-- Shared composable policy predicate
-- usage:  organization_id = public.current_org_id()
--         and public.can_access_branch(branch_id)
-- ---------------------------------------------------------------------------