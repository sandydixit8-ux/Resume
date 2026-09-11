import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/supabase";

export interface AuditEntry {
  action: string;
  entity: string;
  entity_id?: string | null;
  old_value?: Json;
  new_value?: Json;
  organization_id?: string | null;
}

/**
 * Write an audit log row. Called from server actions after successful
 * mutations. Never callable from the client. RLS restricts insert to the
 * caller's own organization; selects require `audit.view`.
 */
export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const organization_id =
      entry.organization_id ??
      (await supabase
        .from("users")
        .select("organization_id")
        .eq("id", user.id)
        .maybeSingle()
        .then((r) => r.data?.organization_id ?? null));

    await supabase.from("audit_logs").insert({
      organization_id,
      user_id: user.id,
      action: entry.action,
      entity: entry.entity,
      entity_id: entry.entity_id ?? null,
      old_value: entry.old_value ?? null,
      new_value: entry.new_value ?? null,
    });
  } catch (err) {
    // Audit must never break the business operation it records.
    console.error("audit log write failed:", err);
  }
}
