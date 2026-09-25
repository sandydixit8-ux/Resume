import { getSession } from "@/lib/auth/get-session";
import { err } from "@/lib/http";
import { all } from "@/lib/db/db";
import { can } from "@/lib/auth/rbac";

export async function GET() {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role as never, "leads:read")) return err.forbidden();

  const contacts = all<{ email: string; name: string; consent: number; source: string; utm_source: string; utm_campaign: string; created_at: string }>(
    "SELECT email, name, consent, source, utm_source, utm_campaign, created_at FROM contacts WHERE tenant_id = ? ORDER BY created_at DESC",
    s.org.id
  );

  const escape = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = [
    ["Email", "Name", "Consent", "Source", "UTM Source", "UTM Campaign", "Captured At"].map(escape).join(","),
    ...contacts.map((c) =>
      [c.email, c.name, c.consent ? "yes" : "no", c.source, c.utm_source, c.utm_campaign, c.created_at].map(escape).join(",")
    ),
  ];

  return new Response(rows.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leads-${s.org.id.slice(0, 8)}.csv"`,
    },
  });
}