import { livenessResponse } from "@/lib/health";

/**
 * Liveness: is the process itself alive? No dependency checks on purpose --
 * a failing liveness probe restarts the container, so it must not fire just
 * because the database is briefly unreachable.
 */
export async function GET() {
  return livenessResponse();
}
