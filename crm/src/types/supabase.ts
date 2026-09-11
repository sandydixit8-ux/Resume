/**
 * Hand-maintained Supabase Database types for the tables used by the app.
 * Kept in sync with supabase/migrations/*.sql.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

/** Table row shape for the postgrest client. Insert/Update stay permissive;
 *  RLS + CHECK constraints guard integrity on the database side. The `Row`
 *  carries an index signature so it satisfies the client's GenericTable. */
type DbTable<Row> = {
  Row: Row & Record<string, unknown>;
  Insert: Record<string, unknown>;
  Update: Record<string, unknown>;
  Relationships: [];
};

export interface LeadSource {
  id: string;
  organization_id: string;
  name: string;
}

export interface Invitation {
  id: string;
  organization_id: string;
  email: string;
  role_slug: string;
  branch_ids: string[];
  token: string;
  expires_at: string;
  accepted_at: string | null;
  created_by: string | null;
  created_at: string;
}

export interface ProductVariant {
  id: string;
  organization_id: string;
  product_id: string;
  sku: string;
  attributes: Json;
  purchase_price: number;
  selling_price: number;
}

export interface AutomationRun {
  id: string;
  organization_id: string;
  automation_id: string | null;
  entity_type: string | null;
  entity_id: string | null;
  ran_at: string;
  success: boolean;
  error: string | null;
}

export interface NotificationPreference {
  user_id: string;
  channel: string;
  category: string;
  enabled: boolean;
}

export interface Webhook {
  id: string;
  organization_id: string;
  url: string;
  secret: string | null;
  events: string[];
  is_active: boolean;
  created_at: string;
}

export interface WebhookLog {
  id: string;
  organization_id: string | null;
  webhook_id: string | null;
  event: string | null;
  payload: Json;
  attempt: number;
  status_code: number | null;
  response: string | null;
  success: boolean;
  idempotency_key: string | null;
  created_at: string;
}

export interface FeatureFlag {
  id: string;
  organization_id: string;
  slug: string;
  enabled: boolean;
}

export interface Organization {
  id: string;
  name: string;
  legal_name: string | null;
  gstin: string | null;
  industry: string;
  currency: string;
  timezone: string;
  logo_url: string | null;
  status: string;
  plan: string;
  created_at: string;
  updated_at: string;
}

export interface Branch {
  id: string;
  organization_id: string;
  name: string;
  code: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AppUser {
  id: string;
  organization_id: string | null;
  email: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  org_scope: "org" | "branch";
  is_active: boolean;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Role {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  description: string | null;
  is_system: boolean;
}

export interface Permission {
  id: string;
  organization_id: string;
  slug: string;
  description: string | null;
}

export interface RolePermission {
  role_id: string;
  permission_id: string;
  organization_id: string;
}

export interface UserRole {
  user_id: string;
  role_id: string;
  organization_id: string;
}

export interface UserBranch {
  user_id: string;
  branch_id: string;
  organization_id: string;
}

export interface Lead {
  id: string;
  organization_id: string;
  branch_id: string | null;
  lead_no: string;
  name: string;
  company: string | null;
  contact_person: string | null;
  mobile: string | null;
  alt_mobile: string | null;
  email: string | null;
  whatsapp_number: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  source: string;
  campaign: string | null;
  product_interest: string | null;
  value: number;
  score: number;
  priority: "HOT" | "WARM" | "COLD";
  status: "NEW" | "CONTACTED" | "QUALIFIED" | "PROPOSAL" | "NEGOTIATION" | "WON" | "LOST" | "NURTURE";
  owner_id: string | null;
  last_contacted_at: string | null;
  next_followup_at: string | null;
  notes: string | null;
  tags: string[];
  converted_customer_id: string | null;
  merged_into_id: string | null;
  is_deleted: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  organization_id: string;
  branch_id: string | null;
  customer_no: string;
  name: string;
  company: string | null;
  category: string | null;
  mobile: string | null;
  email: string | null;
  whatsapp_number: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  gstin: string | null;
  credit_limit: number;
  opt_in_comms: boolean;
  tags: string[];
  assigned_to: string | null;
  is_deleted: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerContact {
  id: string;
  organization_id: string;
  customer_id: string;
  name: string;
  mobile: string | null;
  email: string | null;
  designation: string | null;
}

export interface Pipeline {
  id: string;
  organization_id: string;
  name: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface PipelineStage {
  id: string;
  pipeline_id: string;
  organization_id: string;
  name: string;
  probability: number;
  expected_days: number;
  sort_order: number;
  is_winning: boolean;
  is_losing: boolean;
}

export interface Opportunity {
  id: string;
  organization_id: string;
  branch_id: string | null;
  lead_id: string | null;
  customer_id: string | null;
  pipeline_id: string;
  stage_id: string;
  name: string;
  value: number;
  probability: number;
  expected_close_date: string | null;
  owner_id: string | null;
  next_action_at: string | null;
  last_activity_at: string | null;
  status: "OPEN" | "WON" | "LOST";
  closed_at: string | null;
  lost_reason: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Activity {
  id: string;
  organization_id: string;
  branch_id: string | null;
  entity_type: "lead" | "customer" | "opportunity" | "order" | "quotation" | "invoice" | "delivery" | "task" | "followup" | "visit";
  entity_id: string | null;
  activity_type: "call" | "whatsapp" | "email" | "meeting" | "visit" | "note" | "task" | "system" | "quote" | "order" | "payment" | "delivery";
  direction: "in" | "out" | null;
  summary: string;
  meta: Json;
  performed_at: string;
  created_by: string | null;
}

export interface Task {
  id: string;
  organization_id: string;
  owner_id: string | null;
  subject: string;
  description: string | null;
  due_at: string | null;
  priority: "HIGH" | "NORMAL" | "LOW";
  status: "TODO" | "IN_PROGRESS" | "DONE" | "CANCELLED";
  entity_type: string | null;
  entity_id: string | null;
  completed_at: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Followup {
  id: string;
  organization_id: string;
  branch_id: string | null;
  entity_type: "lead" | "customer" | "opportunity";
  entity_id: string;
  kind: "call" | "whatsapp" | "meeting" | "visit" | "email" | "task" | "custom";
  subject: string;
  due_at: string;
  remind_at: string | null;
  recurring_interval: "daily" | "weekly" | "monthly" | null;
  status: "PENDING" | "DONE" | "SKIPPED" | "CANCELLED";
  completed_at: string | null;
  context: string | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Visit {
  id: string;
  organization_id: string;
  branch_id: string | null;
  customer_id: string | null;
  visit_by: string | null;
  status: "PLANNED" | "STARTED" | "COMPLETED" | "MISSED" | "CANCELLED";
  purpose: string;
  scheduled_at: string;
  check_in_at: string | null;
  check_out_at: string | null;
  lat: number | null;
  lng: number | null;
  notes: string | null;
  outcome: string | null;
  photos: Json;
  next_visit_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Attendance {
  id: string;
  organization_id: string;
  user_id: string;
  date: string;
  check_in_at: string | null;
  check_out_at: string | null;
  check_in_lat: number | null;
  check_in_lng: number | null;
  status: "PRESENT" | "ABSENT" | "LATE" | "ON_LEAVE" | "FIELD_VISIT";
  created_at: string;
}

export interface ProductCategory {
  id: string;
  organization_id: string;
  name: string;
}

export interface Product {
  id: string;
  organization_id: string;
  sku: string;
  name: string;
  description: string | null;
  short_description: string | null;
  category_id: string | null;
  brand: string | null;
  unit: string;
  hsn_sac: string | null;
  tax_rate: number;
  purchase_price: number;
  selling_price: number;
  discount: number;
  min_stock: number;
  image_url: string | null;
  is_active: boolean;
  is_ai_generated: boolean;
  tags: string[];
  attributes: Json;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Warehouse {
  id: string;
  organization_id: string;
  branch_id: string | null;
  name: string;
  address: string | null;
  is_active: boolean;
}

export interface InventoryRow {
  id: string;
  organization_id: string;
  warehouse_id: string;
  product_id: string;
  quantity: number;
  updated_at: string;
}

export interface InventoryTransaction {
  id: string;
  organization_id: string;
  warehouse_id: string;
  product_id: string;
  type: "PURCHASE" | "SALE" | "RETURN" | "ADJUSTMENT" | "TRANSFER_IN" | "TRANSFER_OUT" | "DAMAGE";
  quantity: number;
  ref_type: string | null;
  ref_id: string | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Quotation {
  id: string;
  organization_id: string;
  branch_id: string | null;
  quote_no: string;
  customer_id: string | null;
  lead_id: string | null;
  date: string;
  valid_until: string | null;
  salesperson_id: string | null;
  status: "DRAFT" | "SENT" | "VIEWED" | "ACCEPTED" | "REJECTED" | "EXPIRED" | "CONVERTED";
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total: number;
  terms: string | null;
  notes: string | null;
  converted_order_id: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuotationItem {
  id: string;
  organization_id: string;
  quotation_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  discount: number;
  tax_rate: number;
  line_total: number;
}

export interface Order {
  id: string;
  organization_id: string;
  branch_id: string | null;
  order_no: string;
  customer_id: string;
  salesperson_id: string | null;
  warehouse_id: string | null;
  quote_id: string | null;
  status: "DRAFT" | "CONFIRMED" | "PROCESSING" | "PACKED" | "DISPATCHED" | "OUT_FOR_DELIVERY" | "DELIVERED" | "CANCELLED" | "RETURNED";
  payment_status: "PENDING" | "PARTIAL" | "PAID";
  delivery_address: string | null;
  delivery_city: string | null;
  delivery_date: string | null;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total: number;
  notes: string | null;
  is_deleted: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  organization_id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  discount: number;
  tax_rate: number;
  line_total: number;
  fulfilled_qty: number;
}

export interface Delivery {
  id: string;
  organization_id: string;
  order_id: string;
  driver_name: string | null;
  vehicle_no: string | null;
  tracking_no: string | null;
  address: string | null;
  city: string | null;
  expected_at: string | null;
  delivered_at: string | null;
  status: "PENDING" | "ASSIGNED" | "PICKED" | "DISPATCHED" | "IN_TRANSIT" | "OUT_FOR_DELIVERY" | "DELIVERED" | "FAILED" | "RETURNED";
  proof_url: string | null;
  signature_url: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DeliveryEvent {
  id: string;
  organization_id: string;
  delivery_id: string;
  status: string;
  at: string;
  note: string | null;
  created_by: string | null;
}

export interface Invoice {
  id: string;
  organization_id: string;
  branch_id: string | null;
  invoice_no: string;
  customer_id: string;
  order_id: string | null;
  date: string;
  due_date: string | null;
  status: "DRAFT" | "ISSUED" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "CANCELLED";
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total: number;
  paid_amount: number;
  gst_meta: Json;
  pdf_url: string | null;
  einvoice_meta: Json;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceItem {
  id: string;
  organization_id: string;
  invoice_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  discount: number;
  tax_rate: number;
  line_total: number;
}

export interface Payment {
  id: string;
  organization_id: string;
  invoice_id: string | null;
  order_id: string | null;
  amount: number;
  method: string;
  reference: string | null;
  status: "PENDING" | "RECEIVED" | "FAILED" | "REFUNDED";
  paid_at: string;
  created_by: string | null;
  created_at: string;
}

export interface MessageTemplate {
  id: string;
  organization_id: string;
  name: string;
  channel: string;
  category: string | null;
  body: string;
  variables: string[];
  approval_status: "PENDING" | "APPROVED" | "REJECTED";
  is_active: boolean;
  created_by: string | null;
  created_at: string;
}

export interface Message {
  id: string;
  organization_id: string;
  entity_type: string | null;
  entity_id: string | null;
  direction: "in" | "out";
  channel: string;
  provider: string;
  recipient: string | null;
  body: string;
  template_id: string | null;
  status: "QUEUED" | "SENT" | "DELIVERED" | "READ" | "FAILED";
  provider_ref: string | null;
  error: string | null;
  sent_at: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Campaign {
  id: string;
  organization_id: string;
  name: string;
  channel: string;
  template_id: string | null;
  segment: Json;
  schedule_at: string | null;
  status: "DRAFT" | "SCHEDULED" | "SENDING" | "SENT" | "CANCELLED";
  metrics: Json;
  created_by: string | null;
  created_at: string;
}

export interface CampaignRecipient {
  id: string;
  organization_id: string;
  campaign_id: string;
  recipient_type: string;
  recipient_id: string;
  consent: boolean;
  status: string;
  message_id: string | null;
}

export interface Notification {
  id: string;
  organization_id: string;
  user_id: string | null;
  category: string;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export interface Automation {
  id: string;
  organization_id: string;
  name: string;
  is_active: boolean;
  trigger_type: string;
  trigger_config: Json;
  conditions: Json;
  actions: Json;
  last_run_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AiJob {
  id: string;
  organization_id: string;
  job_type: "assistant" | "scoring" | "catalogue" | "insights";
  input: Json;
  output: Json | null;
  status: "PENDING" | "RUNNING" | "DONE" | "FAILED";
  error: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Document {
  id: string;
  organization_id: string;
  entity_type: string | null;
  entity_id: string | null;
  name: string;
  storage_path: string;
  mime: string | null;
  size: number | null;
  created_by: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  organization_id: string | null;
  user_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  old_value: Json;
  new_value: Json;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface Subscription {
  id: string;
  organization_id: string;
  plan_id: string | null;
  status: "TRIAL" | "ACTIVE" | "PAST_DUE" | "CANCELLED";
  started_at: string;
  renew_at: string | null;
  entitlements: Json;
}

export interface Plan {
  id: string;
  slug: string;
  name: string;
  price: number;
  limits: Json;
}

export type Database = {
  public: {
    Tables: {
      organizations: DbTable<Organization>;
      branches: DbTable<Branch>;
      users: DbTable<AppUser>;
      roles: DbTable<Role>;
      permissions: DbTable<Permission>;
      role_permissions: DbTable<RolePermission>;
      user_roles: DbTable<UserRole>;
      user_branches: DbTable<UserBranch>;
      invitations: DbTable<Invitation>;
      lead_sources: DbTable<LeadSource>;
      pipelines: DbTable<Pipeline>;
      pipeline_stages: DbTable<PipelineStage>;
      leads: DbTable<Lead>;
      customers: DbTable<Customer>;
      customer_contacts: DbTable<CustomerContact>;
      opportunities: DbTable<Opportunity>;
      activities: DbTable<Activity>;
      tasks: DbTable<Task>;
      followups: DbTable<Followup>;
      visits: DbTable<Visit>;
      attendance: DbTable<Attendance>;
      product_categories: DbTable<ProductCategory>;
      products: DbTable<Product>;
      product_variants: DbTable<ProductVariant>;
      warehouses: DbTable<Warehouse>;
      inventory: DbTable<InventoryRow>;
      inventory_transactions: DbTable<InventoryTransaction>;
      quotations: DbTable<Quotation>;
      quotation_items: DbTable<QuotationItem>;
      orders: DbTable<Order>;
      order_items: DbTable<OrderItem>;
      deliveries: DbTable<Delivery>;
      delivery_events: DbTable<DeliveryEvent>;
      invoices: DbTable<Invoice>;
      invoice_items: DbTable<InvoiceItem>;
      payments: DbTable<Payment>;
      message_templates: DbTable<MessageTemplate>;
      messages: DbTable<Message>;
      campaigns: DbTable<Campaign>;
      campaign_recipients: DbTable<CampaignRecipient>;
      notifications: DbTable<Notification>;
      notification_preferences: DbTable<NotificationPreference>;
      automations: DbTable<Automation>;
      automation_runs: DbTable<AutomationRun>;
      ai_jobs: DbTable<AiJob>;
      documents: DbTable<Document>;
      audit_logs: DbTable<AuditLog>;
      webhooks: DbTable<Webhook>;
      webhook_logs: DbTable<WebhookLog>;
      plans: DbTable<Plan>;
      subscriptions: DbTable<Subscription>;
      feature_flags: DbTable<FeatureFlag>;
    };
    Views: Record<string, { Row: Record<string, unknown>; Relationships: [] }>;
    Functions: Record<string, { Args: Record<string, unknown>; Returns: unknown }>;
    Enums: Record<string, string[]>;
    CompositeTypes: Record<string, { Row: Record<string, unknown> }>;
  };
};
