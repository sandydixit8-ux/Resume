-- 0004_sales_inventory.sql
-- Products, warehouses, immutable inventory ledger, quotations, orders,
-- deliveries, invoices, payments.

create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sku text not null,
  name text not null,
  description text,
  short_description text,
  category_id uuid references public.product_categories(id) on delete set null,
  brand text,
  unit text not null default 'piece',
  hsn_sac text,
  tax_rate numeric not null default 0,
  purchase_price numeric not null default 0,
  selling_price numeric not null default 0,
  discount numeric not null default 0,
  min_stock numeric not null default 0,
  image_url text,
  is_active boolean not null default true,
  is_ai_generated boolean not null default false,
  tags text[] not null default '{}',
  attributes jsonb not null default '{}',
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_products_org on public.products(organization_id);
create index if not exists idx_products_sku on public.products(sku);
create index if not exists idx_products_name_trgm on public.products using gin (name gin_trgm_ops);

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  sku text not null,
  attributes jsonb not null default '{}',
  purchase_price numeric not null default 0,
  selling_price numeric not null default 0
);

create table if not exists public.warehouses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  name text not null,
  address text,
  is_active boolean not null default true
);

create table if not exists public.inventory (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  warehouse_id uuid not null references public.warehouses(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity numeric not null default 0,
  updated_at timestamptz not null default now(),
  unique (warehouse_id, product_id)
);

-- Immutable stock movement ledger. Balance is never overwritten; every change
-- appends a row. Compute current stock as sum of deltas per (warehouse, product).
create table if not exists public.inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  warehouse_id uuid not null references public.warehouses(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  type text not null check (type in ('PURCHASE','SALE','RETURN','ADJUSTMENT','TRANSFER_IN','TRANSFER_OUT','DAMAGE')),
  quantity numeric not null check (quantity <> 0),
  ref_type text,
  ref_id uuid,
  note text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_invtxn_product on public.inventory_transactions(product_id, warehouse_id, created_at);

create table if not exists public.quotations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  quote_no text not null,
  customer_id uuid references public.customers(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  date date not null default current_date,
  valid_until date,
  salesperson_id uuid references public.users(id) on delete set null,
  status text not null default 'DRAFT' check (status in ('DRAFT','SENT','VIEWED','ACCEPTED','REJECTED','EXPIRED','CONVERTED')),
  subtotal numeric not null default 0,
  discount_amount numeric not null default 0,
  tax_amount numeric not null default 0,
  total numeric not null default 0,
  terms text,
  notes text,
  converted_order_id uuid,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quotation_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  quotation_id uuid not null references public.quotations(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  quantity numeric not null default 1,
  unit_price numeric not null default 0,
  discount numeric not null default 0,
  tax_rate numeric not null default 0,
  line_total numeric not null default 0
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  order_no text not null,
  customer_id uuid not null references public.customers(id) on delete set null,
  salesperson_id uuid references public.users(id) on delete set null,
  warehouse_id uuid references public.warehouses(id) on delete set null,
  quote_id uuid references public.quotations(id) on delete set null,
  status text not null default 'DRAFT' check (status in ('DRAFT','CONFIRMED','PROCESSING','PACKED','DISPATCHED','OUT_FOR_DELIVERY','DELIVERED','CANCELLED','RETURNED')),
  payment_status text not null default 'PENDING' check (payment_status in ('PENDING','PARTIAL','PAID')),
  delivery_address text,
  delivery_city text,
  delivery_date date,
  subtotal numeric not null default 0,
  discount_amount numeric not null default 0,
  tax_amount numeric not null default 0,
  total numeric not null default 0,
  notes text,
  is_deleted boolean not null default false,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  quantity numeric not null default 1,
  unit_price numeric not null default 0,
  discount numeric not null default 0,
  tax_rate numeric not null default 0,
  line_total numeric not null default 0,
  fulfilled_qty numeric not null default 0
);

create table if not exists public.deliveries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  driver_name text,
  vehicle_no text,
  tracking_no text,
  address text,
  city text,
  expected_at timestamptz,
  delivered_at timestamptz,
  status text not null default 'PENDING' check (status in ('PENDING','ASSIGNED','PICKED','DISPATCHED','IN_TRANSIT','OUT_FOR_DELIVERY','DELIVERED','FAILED','RETURNED')),
  proof_url text,
  signature_url text,
  notes text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.delivery_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  delivery_id uuid not null references public.deliveries(id) on delete cascade,
  status text not null,
  at timestamptz not null default now(),
  note text,
  created_by uuid references public.users(id) on delete set null
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  invoice_no text not null,
  customer_id uuid not null references public.customers(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  date date not null default current_date,
  due_date date,
  status text not null default 'ISSUED' check (status in ('DRAFT','ISSUED','PARTIALLY_PAID','PAID','OVERDUE','CANCELLED')),
  subtotal numeric not null default 0,
  discount_amount numeric not null default 0,
  tax_amount numeric not null default 0,
  total numeric not null default 0,
  paid_amount numeric not null default 0,
  gst_meta jsonb not null default '{}',
  pdf_url text,
  einvoice_meta jsonb not null default '{}',
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  quantity numeric not null default 1,
  unit_price numeric not null default 0,
  discount numeric not null default 0,
  tax_rate numeric not null default 0,
  line_total numeric not null default 0
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invoice_id uuid references public.invoices(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  amount numeric not null check (amount > 0),
  method text not null default 'UPI',
  reference text,
  status text not null default 'RECEIVED' check (status in ('PENDING','RECEIVED','FAILED','REFUNDED')),
  paid_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.product_categories enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.warehouses enable row level security;
alter table public.inventory enable row level security;
alter table public.inventory_transactions enable row level security;
alter table public.quotations enable row level security;
alter table public.quotation_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.deliveries enable row level security;
alter table public.delivery_events enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.payments enable row level security;

create policy "product_categories_all" on public.product_categories for all using (organization_id = public.current_org_id());
create policy "products_all" on public.products for all using (organization_id = public.current_org_id());
create policy "product_variants_all" on public.product_variants for all using (organization_id = public.current_org_id());
create policy "warehouses_select" on public.warehouses for select using (organization_id = public.current_org_id());
create policy "warehouses_write" on public.warehouses for all using (organization_id = public.current_org_id() and public.has_permission('inventory.transfer'));
create policy "inventory_all" on public.inventory for all using (organization_id = public.current_org_id());
create policy "inventory_transactions_all" on public.inventory_transactions for all using (organization_id = public.current_org_id());
create policy "quotations_all" on public.quotations for all using (
  organization_id = public.current_org_id() and public.can_access_branch(branch_id)
);
create policy "quotation_items_all" on public.quotation_items for all using (organization_id = public.current_org_id());
create policy "orders_all" on public.orders for all using (
  organization_id = public.current_org_id() and public.can_access_branch(branch_id)
);
create policy "order_items_all" on public.order_items for all using (organization_id = public.current_org_id());
create policy "deliveries_all" on public.deliveries for all using (organization_id = public.current_org_id());
create policy "delivery_events_all" on public.delivery_events for all using (organization_id = public.current_org_id());
create policy "invoices_all" on public.invoices for all using (
  organization_id = public.current_org_id() and public.can_access_branch(branch_id)
);
create policy "invoice_items_all" on public.invoice_items for all using (organization_id = public.current_org_id());
create policy "payments_all" on public.payments for all using (organization_id = public.current_org_id());