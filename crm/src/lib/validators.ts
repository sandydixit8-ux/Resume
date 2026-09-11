import { z } from "zod";

export const indianMobile = z
  .string()
  .trim()
  .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number");

export const optionalMobile = z
  .union([z.literal(""), indianMobile])
  .optional()
  .transform((v) => (v ? v : null));

export const createLeadSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  company: z.string().trim().max(200).nullable().optional(),
  contact_person: z.string().trim().max(200).nullable().optional(),
  mobile: optionalMobile,
  email: z.union([z.literal(""), z.email("Enter a valid email")]).optional().transform((v) => (v ? v : null)),
  whatsapp_number: optionalMobile,
  address: z.string().trim().max(500).nullable().optional(),
  city: z.string().trim().max(100).nullable().optional(),
  state: z.string().trim().max(100).nullable().optional(),
  pincode: z.string().trim().max(10).nullable().optional(),
  source: z.string().trim().min(1),
  product_interest: z.string().trim().max(300).nullable().optional(),
  value: z.coerce.number().min(0).max(1_000_000_000).default(0),
  priority: z.enum(["HOT", "WARM", "COLD"]).default("COLD"),
  status: z.enum(["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "NEGOTIATION", "WON", "LOST", "NURTURE"]).default("NEW"),
  owner_id: z.string().uuid().nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  tags: z.array(z.string().trim().max(50)).max(20).default([]),
});

export const updateLeadSchema = createLeadSchema.partial();

export const assignLeadsSchema = z.object({
  leadIds: z.array(z.string().uuid()).min(1, "Select at least one lead"),
  owner_id: z.string().uuid("Select a salesperson"),
});

export const createCustomerSchema = z.object({
  name: z.string().trim().min(1, "Customer name is required").max(200),
  company: z.string().trim().max(200).nullable().optional(),
  mobile: optionalMobile,
  email: z.union([z.literal(""), z.email()]).optional().transform((v) => (v ? v : null)),
  whatsapp_number: optionalMobile,
  address: z.string().trim().max(500).nullable().optional(),
  city: z.string().trim().max(100).nullable().optional(),
  state: z.string().trim().max(100).nullable().optional(),
  pincode: z.string().trim().max(10).nullable().optional(),
  gstin: z.string().trim().max(15).nullable().optional(),
  tags: z.array(z.string()).max(20).default([]),
});

export const createFollowupSchema = z.object({
  entity_type: z.enum(["lead", "customer", "opportunity"]),
  entity_id: z.string().uuid(),
  kind: z.enum(["call", "whatsapp", "meeting", "visit", "email", "task", "custom"]).default("call"),
  subject: z.string().trim().min(1, "Subject is required").max(300),
  due_at: z.string().min(1, "Date/time is required"),
  remind_at: z.string().nullable().optional(),
  recurring_interval: z.enum(["daily", "weekly", "monthly"]).nullable().optional(),
  note: z.string().trim().max(2000).nullable().optional(),
});

export const createTaskSchema = z.object({
  subject: z.string().trim().min(1, "Task subject is required").max(300),
  description: z.string().trim().max(2000).nullable().optional(),
  due_at: z.string().nullable().optional(),
  priority: z.enum(["HIGH", "NORMAL", "LOW"]).default("NORMAL"),
  entity_type: z.string().nullable().optional(),
  entity_id: z.string().uuid().nullable().optional(),
});

export const logActivitySchema = z.object({
  entity_type: z.enum(["lead", "customer", "opportunity", "order", "quotation", "invoice", "delivery", "task", "followup", "visit"]),
  entity_id: z.string().uuid(),
  activity_type: z.enum(["call", "whatsapp", "email", "meeting", "visit", "note", "task", "system", "quote", "order", "payment", "delivery"]),
  direction: z.enum(["in", "out"]).nullable().optional(),
  summary: z.string().trim().min(1, "Summary is required").max(1000),
  meta: z.record(z.string(), z.unknown()).default({}),
});

export const createOpportunitySchema = z.object({
  name: z.string().trim().min(1, "Opportunity name is required").max(300),
  lead_id: z.string().uuid().nullable().optional(),
  customer_id: z.string().uuid().nullable().optional(),
  pipeline_id: z.string().uuid().nullable().optional(),
  stage_id: z.string().uuid().nullable().optional(),
  value: z.coerce.number().min(0).default(0),
  expected_close_date: z.string().nullable().optional(),
  owner_id: z.string().uuid().nullable().optional(),
});

export const createProductSchema = z.object({
  sku: z.string().trim().min(1, "SKU is required").max(100),
  name: z.string().trim().min(1, "Product name is required").max(300),
  category_id: z
    .string()
    .uuid()
    .nullable()
    .optional()
    .transform((v) => (v === "" ? null : v)),
  brand: z.string().trim().max(100).nullable().optional(),
  unit: z.string().trim().max(50).default("piece"),
  hsn_sac: z.string().trim().max(20).nullable().optional(),
  tax_rate: z.coerce.number().min(0).max(100).default(18),
  purchase_price: z.coerce.number().min(0).default(0),
  selling_price: z.coerce.number().min(0).default(0),
  min_stock: z.coerce.number().min(0).default(0),
  description: z.string().trim().max(2000).nullable().optional(),
  tags: z.array(z.string()).max(20).default([]),
});

export const onboardingBusinessSchema = z.object({
  name: z.string().trim().min(1, "Business name is required").max(200),
  industry: z.string().trim().min(1),
  legal_name: z.string().trim().max(200).optional(),
  gstin: z.string().trim().max(15).optional(),
});

export const onboardingBranchSchema = z.object({
  name: z.string().trim().min(1, "Branch name is required").max(200),
  address: z.string().trim().max(500).optional(),
  city: z.string().trim().max(100).optional(),
  state: z.string().trim().max(100).optional(),
  pincode: z.string().trim().max(10).optional(),
});

export const inviteUserSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  role_slug: z.string().trim().min(1),
  branch_ids: z.array(z.string().uuid()).default([]),
});

export const createVisitSchema = z.object({
  customer_id: z.string().uuid(),
  purpose: z.string().trim().min(1, "Purpose is required").max(500),
  scheduled_at: z.string().min(1, "Date/time is required"),
});

export const updateProductSchema = createProductSchema.partial();

export const createCategorySchema = z.object({
  name: z.string().trim().min(1, "Category name is required").max(100),
});

export const quotationLineSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.coerce.number().min(0.0001, "Quantity must be greater than 0"),
  unit_price: z.coerce.number().min(0).default(0),
  discount: z.coerce.number().min(0).max(100).default(0),
  tax_rate: z.coerce.number().min(0).max(100).default(18),
});

export const orderLineSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.coerce.number().min(0.0001, "Quantity must be greater than 0"),
  unit_price: z.coerce.number().min(0).default(0),
  discount: z.coerce.number().min(0).max(100).default(0),
  tax_rate: z.coerce.number().min(0).max(100).default(18),
});

export const createQuotationSchema = z.object({
  customer_id: z.string().uuid(),
  lead_id: z.string().uuid().nullable().optional(),
  date: z.string().min(1, "Quote date is required"),
  valid_until: z
    .string()
    .nullable()
    .optional()
    .transform((v) => (v === "" ? null : v)),
  salesperson_id: z
    .string()
    .uuid()
    .nullable()
    .optional()
    .transform((v) => (v === "" ? null : v)),
  terms: z.string().trim().max(2000).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  items: z.array(quotationLineSchema).min(1, "Add at least one item"),
});

export const updateQuotationStatusSchema = z.object({
  status: z.enum(["DRAFT", "SENT", "VIEWED", "ACCEPTED", "REJECTED", "EXPIRED", "CONVERTED"]),
});

export const createOrderSchema = z.object({
  customer_id: z.string().uuid(),
  quote_id: z.string().uuid().nullable().optional(),
  warehouse_id: z
    .string()
    .uuid()
    .nullable()
    .optional()
    .transform((v) => (v === "" ? null : v)),
  salesperson_id: z
    .string()
    .uuid()
    .nullable()
    .optional()
    .transform((v) => (v === "" ? null : v)),
  delivery_address: z.string().trim().max(500).nullable().optional(),
  delivery_city: z.string().trim().max(100).nullable().optional(),
  delivery_date: z
    .string()
    .nullable()
    .optional()
    .transform((v) => (v === "" ? null : v)),
  notes: z.string().trim().max(2000).nullable().optional(),
  items: z.array(orderLineSchema).min(1, "Add at least one item"),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(["DRAFT", "CONFIRMED", "PROCESSING", "PACKED", "DISPATCHED", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED", "RETURNED"]),
});

export const createWarehouseSchema = z.object({
  name: z.string().trim().min(1, "Warehouse name is required").max(200),
  address: z.string().trim().max(500).nullable().optional(),
  branch_id: z.string().uuid().nullable().optional(),
});

export const inventoryAdjustSchema = z.object({
  warehouse_id: z.string().uuid(),
  product_id: z.string().uuid(),
  type: z.enum(["PURCHASE", "RETURN", "ADJUSTMENT", "DAMAGE"]).default("ADJUSTMENT"),
  quantity: z.coerce.number().refine((n) => n !== 0, "Quantity cannot be zero"),
  note: z.string().trim().max(500).nullable().optional(),
});

export const inventoryTransferSchema = z.object({
  from_warehouse_id: z.string().uuid(),
  to_warehouse_id: z.string().uuid(),
  product_id: z.string().uuid(),
  quantity: z.coerce.number().min(0.0001, "Quantity must be greater than 0"),
  note: z.string().trim().max(500).nullable().optional(),
});

export const searchParamsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.string().optional(),
  priority: z.string().optional(),
  source: z.string().optional(),
  owner: z.string().optional(),
  branch: z.string().optional(),
  q: z.string().optional(),
  sort: z.string().optional(),
});
