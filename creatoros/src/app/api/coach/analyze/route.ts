import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/get-session";
import { ok, err } from "@/lib/http";
import { can } from "@/lib/auth/rbac";
import { summary, timeSeries, breakdownBy } from "@/lib/analytics/engine";
import { all, row } from "@/lib/db/db";
import { aiConfigured, complete } from "@/lib/ai/client";
import { bumpUsage, getUsage } from "@/lib/usage";
import { getLimits } from "@/lib/plans";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role as never, "analytics:read")) return err.forbidden();

  if (!aiConfigured()) {
    return ok({
      configured: false,
      message: "AI Coach is not configured. Add AI_API_KEY to your environment to get personalized insights.",
      insights: null,
    });
  }

  const days = clamp(parseInt(req.nextUrl.searchParams.get("days") || "30", 10));
  const summ = summary(s.org.id, days);
  const series = timeSeries(s.org.id, canaryDays(days)).slice(-days);
  const refs = breakdownBy(s.org.id, "ref", days);
  const sources = breakdownBy(s.org.id, "utm_source", days);

  const serviceStats = all<{ name: string; bookings: number }>(
    `SELECT svc.name, COUNT(b.id) AS bookings
     FROM services svc LEFT JOIN bookings b
       ON b.service_id = svc.id AND b.tenant_id = svc.tenant_id AND b.status = 'confirmed' AND b.created_at >= ?
     WHERE svc.tenant_id = ?
     GROUP BY svc.id ORDER BY bookings DESC`,
    new Date(Date.now() - days * 86400000).toISOString(),
    s.org.id
  );

  const recentLeads = all<{ email: string; captured_at: string }>(
    "SELECT email, created_at AS captured_at FROM contacts WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 5",
    s.org.id
  );

  const context = {
    summary: summ,
    days,
    recentViews: series.slice(-7).map((p) => ({ day: p.date, views: p.views, leads: p.leads })),
    topRefs: refs.slice(0, 5),
    topSources: sources.slice(0, 5),
    serviceStats,
    recentLeads,
  };

  const system = `You are the AI growth coach inside CreatorOS, a creator monetization operating system.
Analyze the creator's real data below and return STRICT JSON with exactly this shape:
{
  "score": 0-100 (overall growth score),
  "summary": "2-3 sentence overall assessment",
  "wins": ["2-4 things working well, specific to their data"],
  "opportunities": ["2-4 specific growth opportunities"],
  "quickWins": ["2-3 low-effort actions they can do today"],
  "nextTarget": "one headline metric to focus on next 30 days"
}
Be concrete and reference actual numbers. No markdown, pure JSON.`;

  try {
    const res = await complete(
      [
        { role: "system", content: system },
        { role: "user", content: JSON.stringify(context) },
      ],
      { temperature: 0.4, maxTokens: 900 }
    );
    const parsed = JSON.parse(res.text) as unknown;

    const limits = getLimits((row("SELECT plan FROM organizations WHERE id = ?", s.org.id) as { plan?: string })?.plan ?? "free");
    const used = getUsage(s.org.id, "aiCredits");
    if (limits.aiCredits === -1 || used < limits.aiCredits) {
      bumpUsage(s.org.id, "aiCredits");
    }

    return ok({ configured: true, insights: parsed });
  } catch (e) {
    return ok({
      configured: true,
      insights: null,
      error: (e as Error).message,
    });
  }
}

function clamp(n: number): number {
  if (Number.isNaN(n)) return 30;
  return Math.min(90, Math.max(7, n));
}
function canaryDays(n: number): number {
  return n;
}