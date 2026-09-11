/**
 * Permission slugs registry. Server actions and UI both reference these
 * constants so typos surface at build time.
 */
export const PERM = {
  leadView: "lead.view",
  leadCreate: "lead.create",
  leadEdit: "lead.edit",
  leadDelete: "lead.delete",
  leadAssign: "lead.assign",
  leadExport: "lead.export",
  leadConvert: "lead.convert",
  leadMerge: "lead.merge",
  leadImport: "lead.import",

  customerView: "customer.view",
  customerCreate: "customer.create",
  customerEdit: "customer.edit",
  customerExport: "customer.export",

  opportunityView: "opportunity.view",
  opportunityCreate: "opportunity.create",
  opportunityEdit: "opportunity.edit",
  opportunityMove: "opportunity.move",
  opportunityClose: "opportunity.close",

  taskView: "task.view",
  taskCreate: "task.create",
  taskComplete: "task.complete",

  followupView: "followup.view",
  followupCreate: "followup.create",
  followupComplete: "followup.complete",

  activityView: "activity.view",
  activityLog: "activity.log",

  visitView: "visit.view",
  visitCreate: "visit.create",
  visitCheckin: "visit.checkin",
  visitCheckout: "visit.checkout",

  attendanceView: "attendance.view",
  attendanceCheckin: "attendance.checkin",
  attendanceCheckout: "attendance.checkout",

  productView: "product.view",
  productCreate: "product.create",
  productEdit: "product.edit",
  productAiGenerate: "product.ai-generate",

  inventoryView: "inventory.view",
  inventoryAdjust: "inventory.adjust",
  inventoryTransfer: "inventory.transfer",

  quotationView: "quotation.view",
  quotationCreate: "quotation.create",
  quotationConvert: "quotation.convert",

  orderView: "order.view",
  orderCreate: "order.create",
  orderApprove: "order.approve",
  orderCancel: "order.cancel",

  deliveryView: "delivery.view",
  deliveryCreate: "delivery.create",
  deliveryUpdate: "delivery.update",

  invoiceView: "invoice.view",
  invoiceCreate: "invoice.create",
  invoicePay: "invoice.pay",

  paymentView: "payment.view",
  paymentRecord: "payment.record",

  reportView: "report.view",
  reportExport: "report.export",

  campaignView: "campaign.view",
  campaignCreate: "campaign.create",
  campaignSend: "campaign.send",

  automationView: "automation.view",
  automationEdit: "automation.edit",

  notificationView: "notification.view",

  aiAssistant: "ai.assistant",
  aiInsights: "ai.insights",
  aiScoring: "ai.scoring",
  aiCatalogue: "ai.catalogue",

  adminUsers: "admin.users",
  adminRoles: "admin.roles",
  adminBranches: "admin.branches",
  adminSettings: "admin.settings",
  adminIntegrations: "admin.integrations",
  adminSubscription: "admin.subscription",

  auditView: "audit.view",
} as const;

export type PermissionSlug = (typeof PERM)[keyof typeof PERM];

/**
 * Whether a user (identified by their permission slugs) has at least one of
 * the requested permissions.
 */
export function can(slugs: string[], has: PermissionSlug[]): boolean {
  const set = new Set(has);
  return slugs.some((s) => set.has(s as PermissionSlug));
}
