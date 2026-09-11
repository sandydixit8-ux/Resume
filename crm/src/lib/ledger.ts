import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface LedgerEntry {
  organizationId: string;
  warehouseId: string;
  productId: string;
  type: "PURCHASE" | "SALE" | "RETURN" | "ADJUSTMENT" | "TRANSFER_IN" | "TRANSFER_OUT" | "DAMAGE";
  quantity: number;
  refType?: string | null;
  refId?: string | null;
  note?: string | null;
  createdBy: string;
}

/**
 * Appends an immutable row to inventory_transactions and keeps the per
 * (warehouse, product) summary in `inventory` in sync. The ledger is the
 * source of truth; the summary is only a cache (see migrations/0004).
 * Never edit stock directly without going through this function.
 */
export async function recordInventoryTransaction(entry: LedgerEntry): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();

  const { error: ledgerError } = await supabase.from("inventory_transactions").insert({
    organization_id: entry.organizationId,
    warehouse_id: entry.warehouseId,
    product_id: entry.productId,
    type: entry.type,
    quantity: entry.quantity,
    ref_type: entry.refType ?? null,
    ref_id: entry.refId ?? null,
    note: entry.note ?? null,
    created_by: entry.createdBy,
  });
  if (ledgerError) {
    console.error("recordInventoryTransaction ledger insert failed", ledgerError);
    return { ok: false, error: "Could not record the stock movement." };
  }

  const { error: summaryError } = await syncInventorySummary(supabase, entry);
  if (summaryError) {
    console.error("recordInventoryTransaction summary upsert failed", summaryError);
    return { ok: false, error: "Could not update the stock balance." };
  }

  return { ok: true };
}

/** Keeps the `inventory` cache row in sync: balance = balance + delta. */
async function syncInventorySummary(
  supabase: Awaited<ReturnType<typeof createClient>>,
  entry: LedgerEntry
): Promise<{ error: string | null }> {
  const { data: row } = await supabase
    .from("inventory")
    .select("id, quantity")
    .eq("warehouse_id", entry.warehouseId)
    .eq("product_id", entry.productId)
    .maybeSingle();

  if (row) {
    const { error } = await supabase
      .from("inventory")
      .update({ quantity: Number(row.quantity) + entry.quantity, updated_at: new Date().toISOString() })
      .eq("id", row.id);
    return { error: error?.message ?? null };
  }

  const { error } = await supabase.from("inventory").insert({
    organization_id: entry.organizationId,
    warehouse_id: entry.warehouseId,
    product_id: entry.productId,
    quantity: entry.quantity,
  });
  return { error: error?.message ?? null };
}
