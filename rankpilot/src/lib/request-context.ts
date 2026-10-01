import { randomUUID } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/logger";

/**
 * Request correlation.
 *
 * `x-request-id` is generated in middleware and echoed on the response, so a
 * user can quote one id that ties their report to a log line. A caller-supplied
 * id is accepted (so a gateway's id survives) but length-bounded and stripped of
 * anything that could forge a log field.
 */
const HEADER = "x-request-id";
const MAX_LEN = 64;

export function sanitizeRequestId(candidate: string | null | undefined): string {
  if (!candidate) return randomUUID();
  const cleaned = candidate.replace(/[^A-Za-z0-9._-]/g, "").slice(0, MAX_LEN);
  return cleaned.length > 0 ? cleaned : randomUUID();
}

export function getRequestId(req: Request): string {
  return sanitizeRequestId(req.headers.get(HEADER));
}

export function withRequestId<T extends NextResponse>(req: NextRequest, res: T): T {
  res.headers.set(HEADER, getRequestId(req));
  return res;
}

/**
 * Wraps a handler to emit exactly one structured line per request.
 *
 * Only applied to the routes that matter operationally today (auth, health,
 * admin). Rolling it out to every API route is listed as remaining work in
 * docs/11 rather than being claimed here.
 */
export async function withRequestLogging(
  req: NextRequest,
  route: string,
  handler: () => Promise<NextResponse>,
  context: { userId?: string | null } = {}
): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const startedAt = Date.now();
  try {
    const res = await handler();
    log.info("http.request", {
      requestId,
      route,
      method: req.method,
      status: res.status,
      durationMs: Date.now() - startedAt,
      userId: context.userId ?? null,
    });
    res.headers.set(HEADER, requestId);
    return res;
  } catch (e) {
    // A handler that throws would otherwise be an unhandled 500 with no log
    // line at all, which is exactly the failure nobody notices.
    log.error("http.request", {
      requestId,
      route,
      method: req.method,
      status: 500,
      durationMs: Date.now() - startedAt,
      userId: context.userId ?? null,
      error: e instanceof Error ? { name: e.name, message: e.message } : { name: "Unknown", message: String(e) },
    });
    throw e;
  }
}
