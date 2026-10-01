import { getSession } from "@/lib/auth/get-session";
import { Card } from "@/components/ui";
import { getBranding } from "@/app/api/settings/branding/route";
import { BrandingForm } from "./branding-form";

export const dynamic = "force-dynamic";

export default async function BrandingPage() {
  const s = (await getSession())!;
  const branding = getBranding(s.org.id);

  return (
    <div className="space-y-4">
      <Card className="px-4 py-3 text-sm text-ink-600">
        White-label settings apply to reports and client-facing views. Pro plan and above can hide RankPilot
        branding; on lower plans the footer credit always remains.
      </Card>
      <BrandingForm initial={branding} plan={s.org.plan} />
      <Card className="space-y-2">
        <h2 className="text-sm font-semibold text-ink-900">Preview</h2>
        <div className="rounded-xl border border-ink-200 p-4">
          <div className="flex items-center gap-2">
            {branding.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={branding.logoUrl} alt="" className="h-7 w-7 rounded" />
            ) : (
              <span
                className="flex h-7 w-7 items-center justify-center rounded-lg text-sm font-bold text-white"
                style={{ backgroundColor: branding.primaryColor }}
              >
                {(branding.brandName || "R").slice(0, 1).toUpperCase()}
              </span>
            )}
            <span className="font-semibold" style={{ color: branding.accentColor }}>
              {branding.brandName || "Your brand"}
            </span>
          </div>
          <div className="mt-3 rounded-lg px-3 py-2 text-sm text-white" style={{ backgroundColor: branding.primaryColor }}>
            Sample report header
          </div>
          <div className="mt-3 text-xs text-ink-400">
            {branding.emailFooter || "No footer text"}
            {!branding.hideRankPilotBranding || s.org.plan === "free" ? " · Powered by RankPilot AI" : ""}
          </div>
        </div>
      </Card>
    </div>
  );
}
