import { readinessResponse } from "@/lib/health";

/**
 * Readiness: can this instance serve traffic? 503 when the database is
 * unreachable, so the load balancer drains this instance without restarting it.
 */
export async function GET() {
  return readinessResponse();
}
