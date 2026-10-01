import { NextResponse } from "next/server";
import { z } from "zod";

export function ok(data: unknown, init?: { headers?: Record<string, string> }): NextResponse {
  return NextResponse.json({ ok: true, data }, { headers: init?.headers });
}

export function fail(message: string, status = 400, code = "error"): NextResponse {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

export const err = {
  auth: () => fail("Not authenticated", 401, "auth_required"),
  forbidden: () => fail("You don't have permission", 403, "forbidden"),
  notFound: () => fail("Not found", 404, "not_found"),
  conflict: (message = "Conflict") => fail(message, 409, "conflict"),
  validation: (details: unknown) =>
    NextResponse.json(
      { ok: false, error: { code: "validation", message: "Validation failed", details } },
      { status: 400 }
    ),
  quota: (message = "Plan limit reached") => fail(message, 402, "quota_exceeded"),
  /** A third-party API we called refused or failed. Distinct from server_error:
   *  the request was ours and valid, the dependency's answer was not. */
  upstream: (message = "Upstream provider failed") => fail(message, 502, "upstream_error"),
  server: () => fail("Internal server error", 500, "server_error"),
  rateLimited: (message = "Too many requests. Please slow down.") =>
    fail(message, 429, "rate_limited"),
};

export function parseBody<T extends z.ZodTypeAny>(
  body: unknown,
  schema: T
): { success: true; data: z.infer<T> } | { success: false; error: z.ZodError } {
  const parsed = schema.safeParse(body);
  if (!parsed.success) return { success: false, error: parsed.error };
  return { success: true, data: parsed.data };
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    return (await req.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/**
 * Bucket used when the client address cannot be established. All such clients
 * deliberately share one rate-limit bucket so the limit fails closed.
 */
export const UNKNOWN_CLIENT_IP = "untrusted";

/**
 * Forwarding headers are only trustworthy when a proxy we control sets them.
 * Off by default: a directly-exposed deployment cannot tell a real address
 * from a forged header, and `next start` exposes no socket address to read.
 */
export function trustProxy(): boolean {
  const v = process.env.TRUSTED_PROXY;
  return v === "1" || v === "true";
}

/**
 * Client IP used for rate-limit keys and audit rows.
 *
 * Reading `x-forwarded-for` unconditionally let any caller mint a fresh rate-limit
 * bucket per request, defeating the login, registration and free-audit limits.
 * Each trusted proxy appends the address it saw, so with N trusted proxies the
 * client sits N entries from the right — taking it from the right discards a
 * client-supplied prefix.
 */
export function getClientIp(req: Request): string {
  if (trustProxy()) {
    const hops = Math.max(1, Number(process.env.TRUSTED_PROXY_HOPS || 1) || 1);
    const fwd = req.headers.get("x-forwarded-for");
    if (fwd) {
      const parts = fwd
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);
      if (parts.length >= hops) return parts[parts.length - hops];
    }
    const real = req.headers.get("x-real-ip")?.trim();
    if (real) return real;
  }
  return UNKNOWN_CLIENT_IP;
}
