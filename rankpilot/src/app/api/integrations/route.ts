import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { can } from "@/lib/auth/rbac";
import { err, ok } from "@/lib/http";
import { newId, nowIso, row, run } from "@/lib/db/db";
import { audit } from "@/lib/audit";
import { revokeSearchConsole } from "@/lib/search-console/sync";

const schema = z.object({
  provider: z.enum(["search_console", "analytics", "wp", "webflow", "slack", "serp", "social_publish", "stripe", "ai_search"]),
  status: z.enum(["connected", "disconnected"]),
  meta: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Stores connection state only. Credentials live in environment variables —
 * nothing secret is persisted in the database.
 */
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role, "settings:write")) return err.forbidden();
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return err.validation(parsed.error.issues);
  const { provider, status, meta } = parsed.data;

  const existing = row<{ id: string }>(
    "SELECT id FROM integrations WHERE tenant_id = ? AND provider = ?",
    s.org.id,
    provider
  );
  const now = nowIso();
  // Disconnecting Search Console revokes the imported rows, so the UI stops
  // showing CTR/rank data the moment the source is gone.
  if (provider === "search_console" && status === "disconnected") {
    const removed = revokeSearchConsole(s.org.id);
    if (removed > 0) {
      audit({ tenantId: s.org.id, userId: s.user.id, action: "integrations.search_console_revoked", entity: "integration", entityId: provider, meta: { removedKeywords: removed } });
    }
  }
  if (existing) {
    run("UPDATE integrations SET status = ?, updated_at = ? WHERE id = ?", status, now, existing.id);
  } else {
    run(
      "INSERT INTO integrations (id, tenant_id, provider, status, credentials, meta, created_at, updated_at) VALUES (?, ?, ?, ?, '{}', ?, ?, ?)",
      newId("itg"),
      s.org.id,
      provider,
      status,
      JSON.stringify(meta ?? {}),
      now,
      now
    );
  }

  audit({ tenantId: s.org.id, userId: s.user.id, action: `integrations.${status}`, entity: "integration", entityId: provider });
  return ok({ provider, status });
}
