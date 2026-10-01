import { NextResponse, type NextRequest } from "next/server";
import { sanitizeRequestId } from "@/lib/request-context";

const SECURITY_HEADERS: Record<string, string> = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "X-XSS-Protection": "0",
};

export function proxy(req: NextRequest) {
  // Accept an inbound id so a gateway's identifier survives into application
  // logs, but sanitize it: a caller must not be able to inject newlines or
  // fields into a log line by way of a header.
  const requestId = sanitizeRequestId(req.headers.get("x-request-id"));
  const headers = new Headers(req.headers);
  headers.set("x-request-id", requestId);

  const response = NextResponse.next({ request: { headers } });
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  response.headers.set("x-request-id", requestId);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public).*)"],
};
