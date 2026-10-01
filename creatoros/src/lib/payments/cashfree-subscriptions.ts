import crypto from "node:crypto";

/**
 * Cashfree Subscriptions (Recurring Billing) API layer.
 *
 * Docs verified 2026-09:
 *  POST   /plans                    create a recurring plan
 *  POST   /subscriptions            create mandate
 *  GET    /subscriptions/{id}       fetch subscription
 *  POST   /subscriptions/{id}/manage  cancel | reactivate
 *  GET    /subscriptions/{id}/payments  all charges for a subscription
 *
 * IMPORTANT: the create response carries NO authorisation link. The
 * `SubscriptionEntity` schema has no link field and there is no
 * `fetch_payment_link` endpoint (verified: both return HTTP 404). Mandate
 * authorisation is started client-side by the Cashfront JS SDK:
 *
 *   const cashfree = Cashfree({ mode: "sandbox" });
 *   await cashfree.subscriptionsCheckout({ subsSessionId });
 *
 * where `subsSessionId` is `subscription_session_id` from the create response.
 * See https://www.cashfree.com/docs/payments/subscription/hosted-checkout
 *
 * Lifecycle (docs): INITIALIZED -> BANK_APPROVAL_PENDING -> ACTIVE, with
 * ON_HOLD / PAUSED / CANCELLED / EXPIRED / COMPLETED as terminal or
 * recoverable states. eNACH mandates can take 24-48h for bank confirmation.
 */

const API_VERSION = process.env.CASHFREE_API_VERSION || "2025-01-01";

function sandbox(): boolean {
  return (process.env.CASHFREE_ENV || "sandbox").toLowerCase() !== "live";
}

function baseUrl(): string {
  return sandbox() ? "https://sandbox.cashfree.com/pg" : "https://api.cashfree.com/pg";
}

function headers(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "x-client-id": process.env.CASHFREE_CLIENT_ID || "",
    "x-client-secret": process.env.CASHFREE_SECRET_KEY || "",
    "x-api-version": API_VERSION,
  };
}

export function subscriptionsConfigured(): boolean {
  return Boolean(process.env.CASHFREE_CLIENT_ID && process.env.CASHFREE_SECRET_KEY);
}

async function call<T>(path: string, method: "GET" | "POST", body?: unknown): Promise<{ status: number; data: T }> {
  const res = await fetch(`${baseUrl()}${path}`, {
    method,
    headers: headers(),
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const text = await res.text();
  let data: unknown = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: text.slice(0, 200) };
  }
  return { status: res.status, data: data as T };
}

async function callOrThrow<T>(path: string, method: "GET" | "POST", body?: unknown): Promise<T> {
  const { status, data } = await call<T>(path, method, body);
  if (status >= 400) {
    const d = data as { message?: string; error?: { message?: string } };
    throw new Error(`Cashfree subscriptions error (${status}): ${d.error?.message || d.message || "unknown"}`);
  }
  return data;
}

/** plan_id allows only alphanumerics, dot, hyphen, underscore; max 40 chars. */
export function planIdFor(planKey: string): string {
  const cleaned = planKey.toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 30);
  return `creatoros_${cleaned || "plan"}`;
}

/** Cashfree allows 250 chars of [A-Za-z0-9_.- ] for subscription_id. */
export function subscriptionIdFor(tenantId: string, planKey: string): string {
  const suffix = crypto.randomBytes(6).toString("hex");
  const safeTenant = tenantId.replace(/[^A-Za-z0-9_.-]/g, "").slice(0, 40);
  const safePlan = planKey.replace(/[^A-Za-z0-9_.-]/g, "").slice(0, 40);
  return `sub_${safeTenant}_${safePlan}_${suffix}`.slice(0, 240);
}

/** Cashfree bills in major units (rupees); this app stores cents. */
function toMajorUnits(amountCents: number): number {
  return Math.round((amountCents / 100) * 100) / 100;
}

export interface CfPlan {
  plan_id?: string;
  plan_status?: string;
  message?: string;
}

export interface CfSubscription {
  subscription_id?: string;
  cf_subscription_id?: string;
  subscription_status?: string;
  subscription_session_id?: string;
  next_schedule_date?: string | null;
  subscription_tags?: Record<string, unknown> | null;
  customer_details?: { customer_email?: string };
  message?: string;
}

export interface EnsurePlanArgs {
  planKey: string;
  planName: string;
  amountCents: number;
  currency: string;
  intervalType?: "DAY" | "WEEK" | "MONTH" | "YEAR";
  intervals?: number;
}

/**
 * Idempotently make sure a Cashfree plan exists for this plan key.
 * A duplicate plan returns 400/409 with an "already exists" message, which we
 * treat as success rather than failing checkout.
 */
export async function ensurePlan(args: EnsurePlanArgs): Promise<{ planId: string; created: boolean }> {
  const planId = planIdFor(args.planKey);
  const amount = toMajorUnits(args.amountCents);

  const { status, data } = await call<CfPlan>("/plans", "POST", {
    plan_id: planId,
    plan_name: args.planName.slice(0, 40),
    plan_type: "PERIODIC",
    plan_currency: args.currency.toUpperCase(),
    plan_recurring_amount: amount,
    plan_max_amount: amount,
    plan_max_cycles: 0,
    plan_intervals: args.intervals ?? 1,
    plan_interval_type: args.intervalType ?? "MONTH",
    plan_note: "CreatorOS plan",
  });

  if (status >= 400) {
    const msg = String(data?.message || "").toLowerCase();
    const alreadyExists =
      status === 409 ||
      msg.includes("already exist") ||
      msg.includes("duplicate") ||
      msg.includes("exists");
    if (!alreadyExists) {
      throw new Error(`Cashfree plan creation failed (${status}): ${data?.message || "unknown"}`);
    }
    return { planId, created: false };
  }

  return { planId, created: true };
}

export interface CreateSubscriptionArgs {
  subscriptionId: string;
  planId: string;
  customerEmail: string;
  customerName?: string;
  customerPhone?: string;
  returnUrl: string;
  /** Persisted as subscription_tags so webhooks can be mapped back to a tenant. */
  tags: Record<string, string>;
  paymentMethods?: string[];
}

export interface CreatedSubscription {
  subscriptionId: string;
  /** Fed to Cashfront's `subscriptionsCheckout({ subsSessionId })` in the browser. */
  sessionId: string;
  status: string;
}

/**
 * Create a mandate. The customer must complete authorisation through the
 * Cashfront hosted subscription checkout using the returned session id.
 *
 * Only `plan_id` is sent for the plan: the plan is created separately by
 * `ensurePlan`, and re-sending amount/interval fields here risks the mandate
 * disagreeing with the merchant-level plan object.
 */
export async function createSubscription(args: CreateSubscriptionArgs): Promise<CreatedSubscription> {
  const sub = await callOrThrow<CfSubscription>("/subscriptions", "POST", {
    subscription_id: args.subscriptionId,
    customer_details: {
      // Cashfree rejects an email here with 400 "should be a person name",
      // so this must stay undefined rather than falling back to the email.
      customer_name: args.customerName,
      customer_email: args.customerEmail,
      customer_phone: normalisePhone(args.customerPhone),
    },
    plan_details: {
      plan_id: args.planId,
      plan_type: "PERIODIC",
    },
    authorization_details: {
      payment_methods: args.paymentMethods || ["upi", "card"],
    },
    subscription_meta: {
      return_url: args.returnUrl,
      notification_channel: ["EMAIL"],
    },
    subscription_tags: args.tags,
  });

  const subscriptionId = sub.subscription_id || args.subscriptionId;
  const sessionId = sub.subscription_session_id || "";

  if (!sessionId) {
    throw new Error("Cashfree did not return a subscription_session_id");
  }

  return {
    subscriptionId,
    sessionId,
    status: String(sub.subscription_status || "INITIALIZED"),
  };
}

export async function fetchSubscription(subscriptionId: string): Promise<CfSubscription> {
  return callOrThrow<CfSubscription>(`/subscriptions/${encodeURIComponent(subscriptionId)}`, "GET");
}

/**
 * Docs: action is one of CANCEL | PAUSE | ACTIVATE | CHANGE_PLAN.
 * `next_scheduled_time` is REQUIRED for ACTIVATE and only the date part counts.
 */
export async function cancelSubscriptionRemote(subscriptionId: string): Promise<CfSubscription> {
  return manageSubscription(subscriptionId, "CANCEL");
}

export async function pauseSubscriptionRemote(subscriptionId: string): Promise<CfSubscription> {
  return manageSubscription(subscriptionId, "PAUSE");
}

export async function activateSubscriptionRemote(
  subscriptionId: string,
  nextScheduledTime?: string
): Promise<CfSubscription> {
  // Date-only, and required by Cashfree for ACTIVATE.
  const date = nextScheduledTime ? nextScheduledTime.slice(0, 10) : new Date().toISOString().slice(0, 10);
  return manageSubscription(subscriptionId, "ACTIVATE", { next_scheduled_time: date });
}

export async function changePlanRemote(subscriptionId: string, planId: string): Promise<CfSubscription> {
  return manageSubscription(subscriptionId, "CHANGE_PLAN", { plan_id: planId });
}

function manageSubscription(
  subscriptionId: string,
  action: "CANCEL" | "PAUSE" | "ACTIVATE" | "CHANGE_PLAN",
  actionDetails?: Record<string, string>
): Promise<CfSubscription> {
  return callOrThrow<CfSubscription>(`/subscriptions/${encodeURIComponent(subscriptionId)}/manage`, "POST", {
    subscription_id: subscriptionId,
    action,
    ...(actionDetails ? { action_details: actionDetails } : {}),
  });
}

/** Cashfree expects a 10-digit Indian mobile for domestic rails. */
export function normalisePhone(raw?: string): string | undefined {
  if (!raw) return undefined;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return undefined;
}
