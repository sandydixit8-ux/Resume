import { healthResponse } from "@/lib/health";

/**
 * Backwards-compatible alias for `/api/health/ready`, kept so existing load
 * balancer and container probes keep working unchanged.
 */
export async function GET() {
  return healthResponse();
}
