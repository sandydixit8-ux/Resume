import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { err, ok } from "@/lib/http";
import { getWebsite } from "@/lib/websites/repo";
import { aiCall, isNextResponse } from "@/lib/ai/server";

/** GEO recommendation generator — every item must trace back to observed crawl context. */
const schema = z.object({ websiteId: z.string().min(1) });

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return err.validation(parsed.error.issues);
  if (!getWebsite(s.org.id, parsed.data.websiteId)) return err.notFound();

  const outcome = await aiCall<{
    recommendations: Array<{ title: string; detail: string; effort: string; why: string }>;
  }>(
    "geo.recommendations",
    { websiteId: parsed.data.websiteId },
    "content:write"
  );
  if (isNextResponse(outcome)) return outcome;
  const { result } = outcome;

  return ok({
    recommendations: result.data.recommendations,
    source: result.source,
    degraded: result.degraded ?? null,
    note: "Recommendations derive from observed crawl data only. No traffic or ranking outcomes are implied.",
  });
}
