import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/get-session";
import { err, ok } from "@/lib/http";
import { getWebsite } from "@/lib/websites/repo";
import { row } from "@/lib/db/db";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return err.auth();
  const { id } = await ctx.params;
  if (!getWebsite(s.org.id, id)) return err.notFound();

  const score = row<{
    overall: number;
    components: string;
    methodology: string;
    run_id: string | null;
    created_at: string;
  }>(
    "SELECT overall, components, methodology, run_id, created_at FROM scores WHERE website_id = ? ORDER BY created_at DESC LIMIT 1",
    id
  );
  if (!score) {
    return ok({
      score: null,
      message: "No score yet — run a crawl to generate your Growth Score.",
    });
  }
  return ok({
    score: {
      overall: score.overall,
      components: JSON.parse(score.components),
      methodology: JSON.parse(score.methodology),
      runId: score.run_id,
      measuredAt: score.created_at,
    },
  });
}
