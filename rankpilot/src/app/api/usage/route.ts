import { getSession } from "@/lib/auth/get-session";
import { err, ok } from "@/lib/http";
import { usageReport } from "@/lib/usage";

export async function GET() {
  const s = await getSession();
  if (!s) return err.auth();
  return ok(usageReport(s.org.id, s.org.plan));
}
