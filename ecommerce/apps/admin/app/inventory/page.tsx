"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Alert, Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Skeleton } from "@nexus/ui";
import type { InventoryAdjustInput, InventoryRowDto, InventoryTransferDto, ReorderRowDto, WarehouseDto } from "@nexus/contracts";
import { ApiClientError, adminInventoryApi } from "@/lib/api";
import { RequireAuth } from "@/components/require-auth";

const ADJUST_TYPES: { value: InventoryAdjustInput["type"]; label: string }[] = [
  { value: "PURCHASE", label: "Purchase (add)" },
  { value: "ADJUSTMENT", label: "Adjustment (signed)" },
  { value: "RETURN", label: "Return (add)" },
  { value: "DAMAGE", label: "Damage (remove)" },
];

function inr(value: string | number): string {
  return Number(value).toLocaleString("en-IN", { minimumFractionDigits: 2 });
}

function InventoryPageInner() {
  const [warehouses, setWarehouses] = useState<WarehouseDto[]>([]);
  const [rows, setRows] = useState<InventoryRowDto[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const [whName, setWhName] = useState("");
  const [whCode, setWhCode] = useState("");
  const [whCity, setWhCity] = useState("");
  const [whState, setWhState] = useState("");
  const [whPincode, setWhPincode] = useState("");
  const [whPriority, setWhPriority] = useState("1");
  const [creating, setCreating] = useState(false);

  const [adjustFor, setAdjustFor] = useState<string | null>(null);
  const [adjustDelta, setAdjustDelta] = useState("");
  const [adjustType, setAdjustType] = useState<InventoryAdjustInput["type"]>("PURCHASE");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjusting, setAdjusting] = useState(false);

  const [report, setReport] = useState<ReorderRowDto[]>([]);
  const [reportLoading, setReportLoading] = useState(true);
  const [transfers, setTransfers] = useState<InventoryTransferDto[]>([]);

  const [tfSource, setTfSource] = useState("");
  const [tfDest, setTfDest] = useState("");
  const [tfLines, setTfLines] = useState<{ variantId: string; qty: string }[]>([]);
  const [tfNote, setTfNote] = useState("");
  const [transferring, setTransferring] = useState(false);
  const [transferError, setTransferError] = useState("");

  const [editReorderFor, setEditReorderFor] = useState<string | null>(null);
  const [editPoint, setEditPoint] = useState("");
  const [editQty, setEditQty] = useState("");

  const loadWarehouses = useCallback(async () => {
    try {
      const list = await adminInventoryApi.listWarehouses();
      setWarehouses(list);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Failed to load warehouses");
    }
  }, []);

  const loadRows = useCallback(async () => {
    try {
      const result = await adminInventoryApi.listInventory({
        ...(warehouseId ? { warehouseId } : {}),
        ...(lowStockOnly ? { lowStockOnly: true } : {}),
      });
      setRows(result.data);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Failed to load inventory");
    } finally {
      setLoading(false);
    }
  }, [warehouseId, lowStockOnly]);

  const loadReport = useCallback(async () => {
    try {
      setReport(await adminInventoryApi.getReorderReport());
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Failed to load reorder report");
    } finally {
      setReportLoading(false);
    }
  }, []);

  const loadTransfers = useCallback(async () => {
    try {
      const result = await adminInventoryApi.listTransfers({ pageSize: 5 });
      setTransfers(result.data);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Failed to load transfers");
    }
  }, []);

  useEffect(() => {
    void loadWarehouses();
    void loadReport();
    void loadTransfers();
  }, [loadWarehouses, loadReport, loadTransfers]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  async function handleCreateWarehouse(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError("");
    setNotice("");
    try {
      const warehouse = await adminInventoryApi.createWarehouse({
        name: whName,
        code: whCode,
        ...(whCity ? { city: whCity } : {}),
        ...(whState ? { state: whState } : {}),
        ...(whPincode ? { pincode: whPincode } : {}),
        priority: Number(whPriority),
      });
      setNotice(`Warehouse ${warehouse.code} created`);
      setWhName("");
      setWhCode("");
      setWhCity("");
      setWhState("");
      setWhPincode("");
      setWhPriority("1");
      await loadWarehouses();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Failed to create warehouse");
    } finally {
      setCreating(false);
    }
  }

  async function handleAdjust(e: FormEvent) {
    e.preventDefault();
    if (!adjustFor) return;
    setAdjusting(true);
    setError("");
    setNotice("");
    try {
      await adminInventoryApi.adjustStock({
        warehouseId: rows.find((r) => r.id === adjustFor)?.warehouseId ?? adjustFor,
        variantId: rows.find((r) => r.id === adjustFor)?.productVariantId ?? "",
        quantityDelta: Number(adjustDelta),
        type: adjustType,
        ...(adjustReason ? { reason: adjustReason } : {}),
      });
      setNotice("Stock adjusted");
      setAdjustFor(null);
      setAdjustDelta("");
      setAdjustReason("");
      await loadRows();
      await loadWarehouses();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Failed to adjust stock");
    } finally {
      setAdjusting(false);
    }
  }

  const sourceRows = warehouses.find((w) => w.id === tfSource)
    ? rows.filter((r) => r.warehouseId === tfSource)
    : [];

  function openReorderEditor(row: InventoryRowDto) {
    setEditReorderFor(row.id);
    setEditPoint(String(row.reorderPoint));
    setEditQty(String(row.reorderQuantity));
  }

  async function handleSaveReorder(e: FormEvent) {
    e.preventDefault();
    if (!editReorderFor) return;
    try {
      await adminInventoryApi.updateReorderConfig(editReorderFor, {
        reorderPoint: Number(editPoint) || 0,
        reorderQuantity: Number(editQty) || 0,
      });
      setNotice("Reorder config updated");
      setEditReorderFor(null);
      await loadRows();
      await loadReport();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to update reorder config");
    }
  }

  async function handleTransfer(e: FormEvent) {
    e.preventDefault();
    setTransferring(true);
    setTransferError("");
    setError("");
    setNotice("");
    try {
      const items = tfLines
        .filter((line) => line.variantId && Number(line.qty) > 0)
        .map((line) => ({ variantId: line.variantId, quantity: Number(line.qty) }));
      if (items.length === 0) {
        setTransferError("Enter a quantity for at least one line");
        return;
      }
      const transfer = await adminInventoryApi.createTransfer({
        sourceWarehouseId: tfSource,
        destinationWarehouseId: tfDest,
        items,
        ...(tfNote ? { note: tfNote } : {}),
      });
      setNotice(`Transfer ${transfer.referenceNumber} completed`);
      setTfSource("");
      setTfDest("");
      setTfLines([]);
      setTfNote("");
      await loadRows();
      await loadReport();
      await loadTransfers();
    } catch (err) {
      setTransferError(err instanceof ApiClientError ? err.message : "Failed to create transfer");
    } finally {
      setTransferring(false);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Inventory</h1>
        <p className="text-sm text-muted-foreground">{rows.length} stock rows</p>
      </div>

      {error && <Alert variant="destructive">{error}</Alert>}
      {notice && <Alert variant="success">{notice}</Alert>}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Warehouses</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2">
            {warehouses.length === 0 ? (
              <p className="text-sm text-muted-foreground">No warehouses yet.</p>
            ) : (
              warehouses.map((w) => (
                <div key={w.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                  <div>
                    <span className="font-medium">{w.name}</span>
                    <span className="ml-2 font-mono text-xs text-muted-foreground">{w.code}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {[w.city, w.state].filter(Boolean).join(", ") || "—"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {!w.isActive && <Badge variant="secondary">Inactive</Badge>}
                    <Badge variant="outline">P{w.priority}</Badge>
                  </div>
                </div>
              ))
            )}
          </div>
          <form onSubmit={handleCreateWarehouse} className="grid gap-3 border-t border-border pt-4 sm:grid-cols-3 lg:grid-cols-6" id="create-warehouse">
            <div className="space-y-1">
              <label className="text-sm font-medium">Name</label>
              <Input value={whName} onChange={(e) => setWhName(e.target.value)} required placeholder="Mumbai Hub" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Code</label>
              <Input value={whCode} onChange={(e) => setWhCode(e.target.value)} required placeholder="MUM1" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">City</label>
              <Input value={whCity} onChange={(e) => setWhCity(e.target.value)} placeholder="Mumbai" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">State</label>
              <Input value={whState} onChange={(e) => setWhState(e.target.value)} placeholder="MH" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Pincode</label>
              <Input value={whPincode} onChange={(e) => setWhPincode(e.target.value)} placeholder="400001" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Priority</label>
              <Input
                type="number"
                min={0}
                value={whPriority}
                onChange={(e) => setWhPriority(e.target.value)}
                placeholder="1"
              />
            </div>
            <div className="sm:col-span-3 lg:col-span-6">
              <Button type="submit" disabled={creating}>
                {creating ? "Creating…" : "Create warehouse"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Transfer stock</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleTransfer} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium">Source warehouse</label>
                <select
                  value={tfSource}
                  onChange={(e) => {
                    setTfSource(e.target.value);
                    setTfDest("");
                    setTfLines([]);
                  }}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Select source</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.code})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Destination warehouse</label>
                <select
                  value={tfDest}
                  onChange={(e) => setTfDest(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Select destination</option>
                  {warehouses
                    .filter((w) => w.id !== tfSource)
                    .map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.code})
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {tfSource && sourceRows.length > 0 && (
              <div className="rounded-md border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-3 py-2">Product</th>
                      <th className="px-3 py-2">SKU</th>
                      <th className="px-3 py-2 text-right">Available</th>
                      <th className="px-3 py-2 text-right">Qty to transfer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sourceRows
                      .filter((r) => r.quantity - r.reservedQuantity > 0)
                      .map((r) => {
                        const available = r.quantity - r.reservedQuantity;
                        const line = tfLines.find((l) => l.variantId === r.productVariantId);
                        return (
                          <tr key={r.id} className="border-b border-border">
                            <td className="px-3 py-2">
                              <span className="font-medium">{r.productName}</span>
                              <span className="block text-xs text-muted-foreground">{r.variantName || "—"}</span>
                            </td>
                            <td className="px-3 py-2 font-mono text-xs">{r.sku}</td>
                            <td className="px-3 py-2 text-right">{available}</td>
                            <td className="px-3 py-2 text-right">
                              <Input
                                type="number"
                                min={0}
                                max={available}
                                className="ml-auto w-28"
                                placeholder="0"
                                value={line?.qty ?? ""}
                                onChange={(e) => {
                                  const next = [...tfLines];
                                  const existing = next.find((l) => l.variantId === r.productVariantId);
                                  if (existing) existing.qty = e.target.value;
                                  else next.push({ variantId: r.productVariantId, qty: e.target.value });
                                  setTfLines(next);
                                }}
                              />
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-sm font-medium">Note (optional)</label>
              <Input value={tfNote} onChange={(e) => setTfNote(e.target.value)} placeholder="Replenish for launch" />
            </div>

            {transferError && <Alert variant="destructive">{transferError}</Alert>}

            <Button type="submit" disabled={transferring || !tfSource || !tfDest || tfSource === tfDest}>
              {transferring ? "Transferring…" : "Create transfer"}
            </Button>
          </form>

          {transfers.length > 0 && (
            <div className="border-t border-border pt-4">
              <p className="mb-2 text-sm font-medium">Recent transfers</p>
              <div className="space-y-1">
                {transfers.map((t) => (
                  <div key={t.id} className="flex items-center justify-between rounded-md border border-border px-3 py-1.5 text-sm">
                    <span className="font-mono text-xs">{t.referenceNumber}</span>
                    <span className="text-xs text-muted-foreground">
                      {t.sourceWarehouseCode} → {t.destinationWarehouseCode}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {t.items.map((i) => `${i.sku} ×${i.quantity}`).join(", ")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select
          value={warehouseId}
          onChange={(e) => setWarehouseId(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          aria-label="Filter by warehouse"
        >
          <option value="">All warehouses</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name} ({w.code})
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={lowStockOnly}
            onChange={(e) => setLowStockOnly(e.target.checked)}
            className="h-4 w-4"
          />
          Low stock only
        </label>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Stock levels</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No stock found. Adjust stock against a warehouse to create rows.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2">Product</th>
                    <th className="px-3 py-2">SKU</th>
                    <th className="px-3 py-2">Warehouse</th>
                    <th className="px-3 py-2 text-right">On hand</th>
                    <th className="px-3 py-2 text-right">Reserved</th>
                    <th className="px-3 py-2 text-right">Damaged</th>
                    <th className="px-3 py-2 text-right">Available</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const available = row.quantity - row.reservedQuantity;
    return (
                      <tr key={row.id} className="border-b border-border">
                        <td className="px-3 py-2">
                          <span className="font-medium">{row.productName}</span>
                          <span className="block text-xs text-muted-foreground">{row.variantName || "—"}</span>
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">{row.sku}</td>
                        <td className="px-3 py-2">{row.warehouseCode}</td>
                        <td className="px-3 py-2 text-right">{row.quantity}</td>
                        <td className="px-3 py-2 text-right">{row.reservedQuantity}</td>
                        <td className="px-3 py-2 text-right">{row.damagedQuantity}</td>
                        <td className="px-3 py-2 text-right">
                          <span className={available <= 0 ? "text-red-600" : available <= row.lowStockThreshold ? "text-amber-600" : "text-green-600"}>
                            {available}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          {adjustFor === row.id ? (
                            <button
                              type="button"
                              className="text-sm font-medium text-primary hover:underline"
                              onClick={() => setAdjustFor(null)}
                            >
                              Close
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="text-sm font-medium text-primary hover:underline"
                              onClick={() => setAdjustFor(row.id)}
                            >
                              Adjust
                            </button>
                          )}
                          <span className="mx-1 text-muted-foreground">·</span>
                          {editReorderFor === row.id ? (
                            <button
                              type="button"
                              className="text-sm font-medium text-primary hover:underline"
                              onClick={() => setEditReorderFor(null)}
                            >
                              Close
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="text-sm font-medium text-primary hover:underline"
                              onClick={() => openReorderEditor(row)}
                            >
                              Reorder
                            </button>
                          )}
                          {row.reorderNeeded && (
                            <Badge variant="destructive" className="ml-2">
                              Reorder
                            </Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {editReorderFor && (
            <form onSubmit={handleSaveReorder} className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Reorder point</label>
                <Input type="number" min={0} value={editPoint} onChange={(e) => setEditPoint(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Reorder quantity</label>
                <Input type="number" min={0} value={editQty} onChange={(e) => setEditQty(e.target.value)} />
              </div>
              <div className="flex items-end">
                <Button type="submit">Save reorder config</Button>
              </div>
            </form>
          )}

          {adjustFor && (
            <form onSubmit={handleAdjust} className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">Type</label>
                <select
                  value={adjustType}
                  onChange={(e) => setAdjustType(e.target.value as InventoryAdjustInput["type"])}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {ADJUST_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Delta</label>
                <Input
                  type="number"
                  value={adjustDelta}
                  onChange={(e) => setAdjustDelta(e.target.value)}
                  required
                  placeholder={adjustType === "PURCHASE" ? "10" : "0"}
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className="text-sm font-medium">Reason</label>
                <Input value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} placeholder="Stock received" />
              </div>
              <div className="sm:col-span-4">
                <Button type="submit" disabled={adjusting}>
                  {adjusting ? "Adjusting…" : "Apply adjustment"}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Reorder report</CardTitle>
        </CardHeader>
        <CardContent>
          {reportLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : report.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              All good — nothing below its reorder point.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2">Product</th>
                    <th className="px-3 py-2">SKU</th>
                    <th className="px-3 py-2 text-right">Available</th>
                    <th className="px-3 py-2 text-right">Reserved</th>
                    <th className="px-3 py-2 text-right">Reorder point</th>
                    <th className="px-3 py-2 text-right">Suggested qty</th>
                  </tr>
                </thead>
                <tbody>
                  {report.map((row) => (
                    <tr key={row.productVariantId} className="border-b border-border">
                      <td className="px-3 py-2">
                        <span className="font-medium">{row.productName}</span>
                        <span className="block text-xs text-muted-foreground">{row.variantName || "—"}</span>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{row.sku}</td>
                      <td className="px-3 py-2 text-right font-semibold text-red-600">{row.available}</td>
                      <td className="px-3 py-2 text-right">{row.reserved}</td>
                      <td className="px-3 py-2 text-right">{row.reorderPoint}</td>
                      <td className="px-3 py-2 text-right">{row.suggestedQuantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function InventoryPage() {
  return (
    <RequireAuth>
      <InventoryPageInner />
    </RequireAuth>
  );
}