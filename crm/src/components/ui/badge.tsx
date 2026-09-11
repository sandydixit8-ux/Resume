import * as React from "react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "primary" | "success" | "warning" | "danger" | "info";

const tones: Record<Tone, string> = {
  neutral: "bg-zinc-100 text-zinc-700 border-zinc-200",
  primary: "bg-orange-100 text-orange-800 border-orange-200",
  success: "bg-emerald-100 text-emerald-800 border-emerald-200",
  warning: "bg-amber-100 text-amber-800 border-amber-200",
  danger: "bg-red-100 text-red-700 border-red-200",
  info: "bg-blue-100 text-blue-800 border-blue-200",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

export function Badge({ className, tone = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4",
        tones[tone],
        className
      )}
      {...props}
    />
  );
}

/** Status-specific badge registry. Single place to keep status colors consistent. */
const LEAD_STATUS: Record<string, Tone> = {
  NEW: "info",
  CONTACTED: "primary",
  QUALIFIED: "warning",
  PROPOSAL: "warning",
  NEGOTIATION: "primary",
  WON: "success",
  LOST: "danger",
  NURTURE: "neutral",
};

const PRIORITY: Record<string, Tone> = {
  HOT: "danger",
  WARM: "warning",
  COLD: "neutral",
};

const ORDER_STATUS: Record<string, Tone> = {
  DRAFT: "neutral",
  CONFIRMED: "info",
  PROCESSING: "warning",
  PACKED: "primary",
  DISPATCHED: "info",
  OUT_FOR_DELIVERY: "warning",
  DELIVERED: "success",
  CANCELLED: "danger",
  RETURNED: "danger",
};

const QUOTE_STATUS: Record<string, Tone> = {
  DRAFT: "neutral",
  SENT: "info",
  VIEWED: "warning",
  ACCEPTED: "success",
  REJECTED: "danger",
  EXPIRED: "neutral",
  CONVERTED: "success",
};

const INVOICE_STATUS: Record<string, Tone> = {
  DRAFT: "neutral",
  ISSUED: "info",
  PARTIALLY_PAID: "warning",
  PAID: "success",
  OVERDUE: "danger",
  CANCELLED: "neutral",
};

const TASK_STATUS: Record<string, Tone> = {
  TODO: "neutral",
  IN_PROGRESS: "info",
  DONE: "success",
  CANCELLED: "neutral",
};

const FOLLOWUP_STATUS: Record<string, Tone> = {
  PENDING: "warning",
  DONE: "success",
  SKIPPED: "neutral",
  CANCELLED: "neutral",
};

const VISIT_STATUS: Record<string, Tone> = {
  PLANNED: "info",
  STARTED: "primary",
  COMPLETED: "success",
  MISSED: "danger",
  CANCELLED: "neutral",
};

const PAYMENT_STATUS: Record<string, Tone> = {
  PENDING: "warning",
  RECEIVED: "success",
  FAILED: "danger",
  REFUNDED: "neutral",
};

const DELIVERY_STATUS: Record<string, Tone> = {
  PENDING: "neutral",
  ASSIGNED: "info",
  PICKED: "warning",
  DISPATCHED: "info",
  IN_TRANSIT: "warning",
  OUT_FOR_DELIVERY: "warning",
  DELIVERED: "success",
  FAILED: "danger",
  RETURNED: "danger",
};

const STOCK_TRANSACTION: Record<string, Tone> = {
  PURCHASE: "success",
  SALE: "info",
  RETURN: "primary",
  ADJUSTMENT: "warning",
  TRANSFER_IN: "success",
  TRANSFER_OUT: "primary",
  DAMAGE: "danger",
};

export function leadStatusTone(status: string): Tone {
  return LEAD_STATUS[status] ?? "neutral";
}
export function priorityTone(p: string): Tone {
  return PRIORITY[p] ?? "neutral";
}
export function orderStatusTone(s: string): Tone {
  return ORDER_STATUS[s] ?? "neutral";
}
export function quoteStatusTone(s: string): Tone {
  return QUOTE_STATUS[s] ?? "neutral";
}
export function invoiceStatusTone(s: string): Tone {
  return INVOICE_STATUS[s] ?? "neutral";
}
export function taskStatusTone(s: string): Tone {
  return TASK_STATUS[s] ?? "neutral";
}
export function followupStatusTone(s: string): Tone {
  return FOLLOWUP_STATUS[s] ?? "neutral";
}
export function visitStatusTone(s: string): Tone {
  return VISIT_STATUS[s] ?? "neutral";
}
export function paymentStatusTone(s: string): Tone {
  return PAYMENT_STATUS[s] ?? "neutral";
}
export function deliveryStatusTone(s: string): Tone {
  return DELIVERY_STATUS[s] ?? "neutral";
}
export function stockTransactionTone(s: string): Tone {
  return STOCK_TRANSACTION[s] ?? "neutral";
}

export function humanize(status: string): string {
  return status.replaceAll("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}
