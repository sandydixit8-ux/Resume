-- 0006_seed_bootstrap.sql
-- Platform plans + per-organization bootstrap (roles, permissions, pipeline,
-- lead sources). Called from server when an organization is created.

insert into public.plans (slug, name, price, limits) values
  ('FREE', 'Free Trial', 0, '{"users":3,"leads":200,"branches":1,"storage_mb":100,"whatsapp_msgs":200,"automations":5,"ai":true}'),
  ('STARTER', 'Starter', 999, '{"users":10,"leads":2000,"branches":3,"storage_mb":1000,"whatsapp_msgs":5000,"automations":20,"ai":true}'),
  ('GROWTH', 'Growth', 2499, '{"users":25,"leads":10000,"branches":10,"storage_mb":5000,"whatsapp_msgs":20000,"automations":50,"ai":true}'),
  ('BUSINESS', 'Business', 5999, '{"users":100,"leads":100000,"branches":50,"storage_mb":25000,"whatsapp_msgs":100000,"automations":200,"ai":true}'),
  ('ENTERPRISE', 'Enterprise', 0, '{"users":-1,"leads":-1,"branches":-1,"storage_mb":-1,"whatsapp_msgs":-1,"automations":-1,"ai":true}')
on conflict (slug) do nothing;

-- Seeds the standard permission set, roles, pipeline, stages and lead sources
-- for a brand new organization. Safe to run repeatedly.
create or replace function public.bootstrap_organization(p_org uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role uuid;
  v_perm uuid;
  v_pipe uuid;
  v_src uuid;
begin
  -- Permissions ------------------------------------------------------------
  foreach v_perm in array array[
    'lead.view','lead.create','lead.edit','lead.delete','lead.assign','lead.export','lead.convert','lead.merge','lead.import',
    'customer.view','customer.create','customer.edit','customer.delete','customer.export',
    'opportunity.view','opportunity.create','opportunity.edit','opportunity.move','opportunity.close',
    'task.view','task.create','task.edit','task.complete','task.delete',
    'followup.view','followup.create','followup.edit','followup.complete',
    'activity.view','activity.log','activity.delete',
    'visit.view','visit.create','visit.checkin','visit.checkout','visit.manage',
    'attendance.view','attendance.checkin','attendance.checkout','attendance.manage',
    'product.view','product.create','product.edit','product.delete','product.import','product.ai-generate',
    'inventory.view','inventory.adjust','inventory.transfer',
    'quotation.view','quotation.create','quotation.edit','quotation.send','quotation.convert','quotation.delete',
    'order.view','order.create','order.edit','order.approve','order.cancel','order.dispatch',
    'delivery.view','delivery.create','delivery.update','delivery.cancel',
    'invoice.view','invoice.create','invoice.edit','invoice.pay','invoice.cancel','invoice.export',
    'payment.view','payment.record','payment.refund',
    'report.view','report.export',
    'campaign.view','campaign.create','campaign.send','campaign.manage_consent',
    'automation.view','automation.edit','automation.run',
    'notification.view','notification.manage_prefs','notification.send',
    'ai.assistant','ai.insights','ai.scoring','ai.catalogue',
    'admin.users','admin.roles','admin.branches','admin.settings','admin.integrations','admin.subscription',
    'audit.view'
  ] loop
    insert into public.permissions (organization_id, slug) values (p_org, v_perm)
    on conflict (organization_id, slug) do nothing;
  end loop;

  -- Roles ---------------------------------------------------------------
  -- BUSINESS_OWNER : everything in this organization
  insert into public.roles (organization_id, name, slug, description, is_system)
  values (p_org, 'Business Owner', 'BUSINESS_OWNER', 'Full access to the business', true)
  on conflict (organization_id, slug) do nothing;
  -- ADMIN
  insert into public.roles (organization_id, name, slug, description, is_system)
  values (p_org, 'Admin', 'ADMIN', 'Operational admin (no billing)', true)
  on conflict (organization_id, slug) do nothing;
  -- SALES_MANAGER
  insert into public.roles (organization_id, name, slug, description, is_system)
  values (p_org, 'Sales Manager', 'SALES_MANAGER', 'Team pipeline and assignments', true)
  on conflict (organization_id, slug) do nothing;
  -- SALES_EXECUTIVE
  insert into public.roles (organization_id, name, slug, description, is_system)
  values (p_org, 'Sales Executive', 'SALES_EXECUTIVE', 'Own leads, follow-ups, quotes, orders', true)
  on conflict (organization_id, slug) do nothing;
  -- FIELD_EXECUTIVE
  insert into public.roles (organization_id, name, slug, description, is_system)
  values (p_org, 'Field Executive', 'FIELD_EXECUTIVE', 'Visits and attendance', true)
  on conflict (organization_id, slug) do nothing;
  -- WAREHOUSE_MANAGER
  insert into public.roles (organization_id, name, slug, description, is_system)
  values (p_org, 'Warehouse Manager', 'WAREHOUSE_MANAGER', 'Stock and dispatch', true)
  on conflict (organization_id, slug) do nothing;
  -- DELIVERY_EXECUTIVE
  insert into public.roles (organization_id, name, slug, description, is_system)
  values (p_org, 'Delivery Executive', 'DELIVERY_EXECUTIVE', 'Deliveries and POD', true)
  on conflict (organization_id, slug) do nothing;
  -- ACCOUNTANT
  insert into public.roles (organization_id, name, slug, description, is_system)
  values (p_org, 'Accountant', 'ACCOUNTANT', 'Invoices, payments, reports', true)
  on conflict (organization_id, slug) do nothing;

  -- role_permissions -------------------------------------------------------
  insert into public.role_permissions (role_id, permission_id, organization_id)
  select r.id, p.id, p_org
  from public.roles r cross join public.permissions p
  where r.organization_id = p_org and p.organization_id = p_org
    and r.slug in ('BUSINESS_OWNER','ADMIN')
  on conflict do nothing;

  insert into public.role_permissions (role_id, permission_id, organization_id)
  select r.id, p.id, p_org
  from public.roles r cross join public.permissions p
  where r.organization_id = p_org and p.organization_id = p_org
    and r.slug = 'SALES_MANAGER'
    and p.slug in (
      'lead.view','lead.create','lead.edit','lead.assign','lead.export','lead.convert','lead.merge','lead.import',
      'customer.view','customer.create','customer.edit','customer.export',
      'opportunity.view','opportunity.create','opportunity.edit','opportunity.move','opportunity.close',
      'task.view','task.create','task.edit','task.complete','task.delete',
      'followup.view','followup.create','followup.edit','followup.complete',
      'activity.view','activity.log','visit.view','visit.create','visit.checkin','visit.checkout','visit.manage',
      'attendance.view','attendance.checkin','attendance.checkout','attendance.manage',
      'product.view','quotation.view','quotation.create','quotation.edit','quotation.send','quotation.convert',
      'order.view','order.create','order.approve','order.cancel','order.dispatch',
      'delivery.view','delivery.create','delivery.update',
      'invoice.view','payment.view','report.view','report.export',
      'campaign.view','campaign.create','automation.view','notification.view','notification.manage_prefs',
      'ai.assistant','ai.insights','ai.scoring'
    )
  on conflict do nothing;

  insert into public.role_permissions (role_id, permission_id, organization_id)
  select r.id, p.id, p_org
  from public.roles r cross join public.permissions p
  where r.organization_id = p_org and p.organization_id = p_org
    and r.slug = 'SALES_EXECUTIVE'
    and p.slug in (
      'lead.view','lead.create','lead.edit','lead.convert','lead.merge',
      'customer.view','customer.create','customer.edit',
      'opportunity.view','opportunity.create','opportunity.edit','opportunity.move',
      'task.view','task.create','task.edit','task.complete',
      'followup.view','followup.create','followup.edit','followup.complete',
      'activity.view','activity.log','visit.view','visit.create','visit.checkin','visit.checkout',
      'attendance.checkin','attendance.checkout',
      'product.view','quotation.view','quotation.create','quotation.edit','quotation.send','quotation.convert',
      'order.view','order.create',
      'notification.view','notification.manage_prefs','ai.assistant','ai.scoring'
    )
  on conflict do nothing;

  insert into public.role_permissions (role_id, permission_id, organization_id)
  select r.id, p.id, p_org
  from public.roles r cross join public.permissions p
  where r.organization_id = p_org and p.organization_id = p_org
    and r.slug = 'FIELD_EXECUTIVE'
    and p.slug in (
      'lead.view','customer.view','visit.create','visit.checkin','visit.checkout',
      'attendance.checkin','attendance.checkout','activity.log'
    )
  on conflict do nothing;

  insert into public.role_permissions (role_id, permission_id, organization_id)
  select r.id, p.id, p_org
  from public.roles r cross join public.permissions p
  where r.organization_id = p_org and p.organization_id = p_org
    and r.slug = 'WAREHOUSE_MANAGER'
    and p.slug in (
      'order.view','order.dispatch','product.view','inventory.view','inventory.adjust','inventory.transfer',
      'delivery.view','delivery.create','delivery.update'
    )
  on conflict do nothing;

  insert into public.role_permissions (role_id, permission_id, organization_id)
  select r.id, p.id, p_org
  from public.roles r cross join public.permissions p
  where r.organization_id = p_org and p.organization_id = p_org
    and r.slug = 'DELIVERY_EXECUTIVE'
    and p.slug in ('order.view','delivery.view','delivery.update','attendance.checkin','attendance.checkout')
  on conflict do nothing;

  insert into public.role_permissions (role_id, permission_id, organization_id)
  select r.id, p.id, p_org
  from public.roles r cross join public.permissions p
  where r.organization_id = p_org and p.organization_id = p_org
    and r.slug = 'ACCOUNTANT'
    and p.slug in (
      'customer.view','invoice.view','invoice.create','invoice.edit','invoice.pay','invoice.export',
      'payment.view','payment.record','payment.refund','report.view','report.export','audit.view'
    )
  on conflict do nothing;

  -- Default pipeline -------------------------------------------------------
  insert into public.pipelines (organization_id, name, is_default)
  values (p_org, 'Sales Pipeline', true)
  on conflict do nothing;

  select id into v_pipe from public.pipelines
  where organization_id = p_org and is_default = true limit 1;

  if v_pipe is not null and not exists (
    select 1 from public.pipeline_stages where pipeline_id = v_pipe
  ) then
    insert into public.pipeline_stages (pipeline_id, organization_id, name, probability, expected_days, sort_order, is_winning, is_losing) values
      (v_pipe, p_org, 'New Lead', 10, 1, 0, false, false),
      (v_pipe, p_org, 'Contacted', 20, 2, 10, false, false),
      (v_pipe, p_org, 'Qualified', 35, 3, 20, false, false),
      (v_pipe, p_org, 'Requirement Identified', 50, 4, 30, false, false),
      (v_pipe, p_org, 'Quotation Sent', 60, 5, 40, false, false),
      (v_pipe, p_org, 'Negotiation', 75, 7, 50, false, false),
      (v_pipe, p_org, 'Won', 100, 0, 60, true, false),
      (v_pipe, p_org, 'Lost', 0, 0, 70, false, true);
  end if;

  -- Lead sources -----------------------------------------------------------
  if not exists (select 1 from public.lead_sources where organization_id = p_org) then
    foreach v_src in array array['Website','Facebook','WhatsApp','IndiaMART','Referral','Phone','Email','Walk-in','Import','Manual Entry','API']
    loop
      insert into public.lead_sources (organization_id, name) values (p_org, v_src);
    end loop;
  end if;
end;
$$;