import crypto from "node:crypto";

/**
 * Cashfree Subscriptions (Recurring Billing) API layer.
 *
 * Docs verified 2026-09:
 *  POST   /plans                                  create a recurring plan
 *  POST   /subscriptions                          create mandate, returns auth link
 *  GET    /subscriptions/{id}                     fetch subscription
 *  POST   /subscriptions/{id}/manage              CANCEL | PAUSE | ACTIVATE | CHANGE_PLAN
 *  GET    /subscriptions/{id}/payments            all charges for a subscription
 *  GET    /subscriptions/{id}/fetch_payment_link   re-fetch the authorisation link
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

export function subscriptionIdFor(tenantId: string, planKey: string): string {
  const suffix = crypto.randomBytes(6).toString("hex");
  return `sub_${tenantId}_${planKey}_${suffix}`.slice(0, 64);
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
  amountCents: number;
  currency: string;
  customerEmail: string;
  customerName?: string;
  customerPhone?: string;
  returnUrl: string;
  /** Persisted as subscription_tags so webhooks can be mapped back to a tenant. */
  tags: Record<string, string>;
  paymentMethods?: string[];
}

/**
 * Create a mandate. The response carries the authorisation link the customer
 * must visit to activate the subscription.
 */
export async function createSubscription(args: CreateSubscriptionArgs): Promise<{
  subscriptionId: string;
  authLink: string;
}> {
  const amount = toMajorUnits(args.amountCents);

  const sub = await callOrThrow<CfSubscription>("/subscriptions", "POST", {
    subscription_id: args.subscriptionId,
    customer_details: {
      customer_name: args.customerName || args.customerEmail,
      customer_email: args.customerEmail,
      customer_phone: normalisePhone(args.customerPhone),
    },
    plan_details: {
      plan_id: args.planId,
      plan_name: args.planId,
      plan_type: "PERIODIC",
      plan_currency: args.currency.toUpperCase(),
      plan_recurring_amount: amount,
      plan_max_amount: amount,
      plan_max_cycles: 0,
      plan_intervals: 1,
      plan_interval_type: "MONTH",
    },
    authorization_details: {
      authorization_amount: amount,
      authorization_amount_refund: true,
      payment_methods: args.paymentMethods || ["upi", "card", "enach", "pnach"],
    },
    subscription_meta: {
      return_url: args.returnUrl,
      notification_channel: ["EMAIL"],
    },
    subscription_note: "CreatorOS plan subscription",
    subscription_tags: args.tags,
  });

  const subscriptionId = sub.subscription_id || args.subscriptionId;

  let authLink = extractAuthLink(sub);
  if (!authLink) authLink = await fetchAuthLink(subscriptionId);

  if (!authLink) {
    throw new Error("Cashfree did not return a subscription authorisation link");
  }

  return { subscriptionId, authLink };
}

/**
 * Cashfree has returned the authorisation link under different keys across API
 * versions, so probe the known shapes before giving up.
 */
function extractAuthLink(sub: CfSubscription): string {
  const bag = sub as unknown as Record<string, unknown>;
  const candidates = [
    bag["auth_link"],
    bag["authorization_link"],
    bag["payment_link"],
    bag["subscription_link"],
    (bag["authorization_details"] as Record<string, unknown> | undefined)?.["auth_link"],
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.startsWith("http")) return c;
  }
  return "";
}

async function fetchAuthLink(subscriptionId: string): Promise<string> {
  const paths = [
    `/subscriptions/${encodeURIComponent(subscriptionId)}/fetch_payment_link`,
    `/subscriptions/${encodeURIComponent(subscriptionId)}/payment_link`,
  ];
  for (const path of paths) {
    try {
      const { status, data } = await call<Record<string, unknown>>(path, "GET");
      if (status < 400) {
        const link = extractAuthLink(data);
        if (link) return link;
      }
    } catch {
      // try the next documented shape
    }
  }
  return "";
}

export async function fetchSubscription(subscriptionId: string): Promise<CfSubscription> {
  return callOrThrow<CfSubscription>(`/subscriptions/${encodeURIComponent(subscriptionId)}`, "GET");
}

export async function cancelSubscriptionRemote(subscriptionId: string): Promise<CfSubscription> {
  return callOrThrow<CfSubscription>(`/subscriptions/${encodeURIComponent(subscriptionId)}/manage`, "POST", {
    subscription_id: subscriptionId,
    action: "CANCEL",
  });
}

export async function pauseSubscriptionRemote(subscriptionId: string, nextScheduledTime?: string): Promise<CfSubscription> {
  return callOrThrow<CfSubscription>(`/subscriptions/${encodeURIComponent(subscriptionId)}/manage`, "POST", {
    subscription_id: subscriptionId,
    action: "PAUSE",
    action_details: nextScheduledTime ? { next_scheduled_time: nextScheduledTime } : {},
  });
}

export async function activateSubscriptionRemote(subscriptionId: string, nextScheduledTime?: string): Promise<CfSubscription> {
  return callOrThrow<CfSubscription>(`/subscriptions/${encodeURIComponent(subscriptionId)}/manage`, "POST", {
    subscription_id: subscriptionId,
    action: "ACTIVATE",
    action_details: nextScheduledTime ? { next_scheduled_time: nextScheduledTime } : {},
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
