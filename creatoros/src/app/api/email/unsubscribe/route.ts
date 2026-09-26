import { NextRequest } from "next/server";
import { verify } from "@/lib/auth/session";
import { all, run, newId, nowIso } from "@/lib/db/db";

export const dynamic = "force-dynamic";

/** Public unsubscribe link: ?t=<signed token>{scope, tenantId, email} */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("t") || "";
  const payload = verify(token);
  const tenantId = payload?.tenantId as string | undefined;
  const email = payload?.email as string | undefined;

  if (!tenantId || !email) {
    return Response.json({ ok: false, error: { code: "invalid_token", message: "Invalid or expired unsubscribe link" } }, { status: 400 });
  }

  const existing = all("SELECT id FROM unsubscribes WHERE tenant_id = ? AND email = ?", tenantId, email.toLowerCase());
  if (existing.length === 0) {
    run(
      "INSERT INTO unsubscribes (id, tenant_id, email, created_at) VALUES (?, ?, ?, ?)",
      newId("uns"),
      tenantId,
      email.toLowerCase(),
      nowIso()
    );
  }

  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><title>Unsubscribed</title>
     <style>body{font-family:system-ui;background:#f8fafc;display:grid;place-items:center;height:100vh;margin:0}main{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:40px;max-width:420px;text-align:center}h1{font-size:20px;margin:0 0 8px}p{color:#64748b;font-size:14px}</style>
     </head><body><main><h1>You&apos;re unsubscribed</h1><p>We&apos;ve removed <strong>${email}</strong> from future emails. You can change your mind anytime.</p></main></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}