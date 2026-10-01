import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { can } from "@/lib/auth/rbac";
import { err, ok } from "@/lib/http";
import { row, run } from "@/lib/db/db";
import { audit } from "@/lib/audit";

const schema = z.object({
  brandName: z.string().max(80).default(""),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#2563eb"),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#0f172a"),
  logoUrl: z.string().max(500).default(""),
  emailFooter: z.string().max(300).default(""),
  hideRankPilotBranding: z.boolean().default(false),
});

type Branding = z.infer<typeof schema>;

export function getBranding(tenantId: string): Branding {
  const r = row<{ branding: string }>("SELECT branding FROM organizations WHERE id = ?", tenantId);
  try {
    return { ...schema.parse({}), ...(JSON.parse(r?.branding || "{}") as Partial<Branding>) };
  } catch {
    return schema.parse({});
  }
}

export async function GET() {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role, "settings:read")) return err.forbidden();
  return ok({ branding: getBranding(s.org.id) });
}

export async function PUT(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role, "settings:write")) return err.forbidden();
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return err.validation(parsed.error.issues);
  run("UPDATE organizations SET branding = ?, updated_at = ? WHERE id = ?", JSON.stringify(parsed.data), new Date().toISOString(), s.org.id);
  audit({ tenantId: s.org.id, userId: s.user.id, action: "settings.branding", entity: "organization", entityId: s.org.id });
  return ok({ branding: parsed.data });
}
