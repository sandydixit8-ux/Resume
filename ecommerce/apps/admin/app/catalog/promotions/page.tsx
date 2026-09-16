"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Alert, Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Skeleton } from "@nexus/ui";
import type { PromotionDto, PromotionScopeValue, PromotionTypeValue, ProductSummary } from "@nexus/contracts";
import { ApiClientError, adminCatalogApi, adminPricingApi } from "@/lib/api";
import { RequireAuth } from "@/components/require-auth";
import { CatalogTabs } from "@/components/catalog-tabs";

const TYPE_LABEL: Record<PromotionTypeValue, string> = {
  PERCENTAGE_OFF: "Percent off",
  FLAT_OFF: "Flat off",
};

function PromotionStatusBadge({ p }: { p: PromotionDto }) {
  if (p.status === "PAUSED") return <Badge variant="secondary">Paused</Badge>;
  if (p.status === "UPCOMING") return <Badge>Upcoming</Badge>;
  if (p.status === "RUNNING") return <Badge variant="success">Running</Badge>;
  return <Badge variant="destructive">Ended</Badge>;
}

function PromotionsPageInner() {
  const [promotions, setPromotions] = useState<PromotionDto[]>([]);
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [name, setName] = useState("");
  const [type, setType] = useState<PromotionTypeValue>("PERCENTAGE_OFF");
  const [value, setValue] = useState("");
  const [scope, setScope] = useState<PromotionScopeValue>("ALL");
  const [minQuantity, setMinQuantity] = useState("1");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [priority, setPriority] = useState("0");
  const [isActive, setIsActive] = useState(true);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  const load = useCallback(async () => {
    setError("");
    try {
      setPromotions(await adminPricingApi.listPromotions());
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Failed to load promotions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let mounted = true;
    adminCatalogApi
      .listProducts({ pageSize: 50 })
      .then((result) => {
        if (mounted) setProducts(result.data);
      })
      .catch(() => {
        /* handled elsewhere */
      });
    return () => {
      mounted = false;
    };
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await adminPricingApi.createPromotion({
        name,
        type,
        value: Number(value),
        scope,
        minQuantity: Number(minQuantity),
        startAt: new Date(startAt || defaultStart).toISOString(),
        endAt: new Date(endAt).toISOString(),
        priority: Number(priority) || 0,
        isActive,
        ...(scope === "PRODUCT" ? { products: selectedProductIds } : {}),
      });
      setNotice("Promotion created");
      setName("");
      setValue("");
      setSelectedProductIds([]);
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to create promotion");
    } finally {
      setBusy(false);
    }
  }

  async function handleToggle(p: PromotionDto) {
    setError("");
    setNotice("");
    try {
      await adminPricingApi.updatePromotion(p.id, {
        name: p.name,
        type: p.type,
        value: Number(p.value),
        scope: p.scope,
        minQuantity: p.minQuantity,
        startAt: p.startAt,
        endAt: p.endAt,
        priority: p.priority,
        isActive: !p.active,
        ...(p.scope === "PRODUCT" ? { products: p.products.map((x) => x.id) } : {}),
        ...(p.scope === "VARIANT" ? { variants: p.variants.map((x) => x.id) } : {}),
      });
      setNotice(p.active ? "Promotion paused" : "Promotion activated");
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to update promotion");
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this promotion?")) return;
    setError("");
    setNotice("");
    try {
      await adminPricingApi.deletePromotion(id);
      setNotice("Promotion deleted");
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to delete promotion");
    }
  }

  const now = new Date();
  const defaultStart = `${now.toISOString().slice(0, 16)}`;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Promotions</h1>
        <p className="text-sm text-muted-foreground">
          Discounts applied per line at checkout; higher priority wins when several apply.
        </p>
      </div>

      {error && <Alert variant="destructive">{error}</Alert>}
      {notice && <Alert variant="success">{notice}</Alert>}

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Create promotion</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Season Sale" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as PromotionTypeValue)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="PERCENTAGE_OFF">Percent off</option>
                <option value="FLAT_OFF">Flat off (₹)</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">{type === "PERCENTAGE_OFF" ? "Percent" : "Amount (₹)"}</label>
              <Input type="number" min={1} value={value} onChange={(e) => setValue(e.target.value)} required placeholder={type === "PERCENTAGE_OFF" ? "10" : "500"} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Scope</label>
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value as PromotionScopeValue)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="ALL">All products</option>
                <option value="PRODUCT">Selected products</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Min quantity</label>
              <Input type="number" min={1} step={1} value={minQuantity} onChange={(e) => setMinQuantity(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Priority</label>
              <Input type="number" min={0} step={1} value={priority} onChange={(e) => setPriority(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Starts at</label>
              <Input type="datetime-local" value={startAt || defaultStart} onChange={(e) => setStartAt(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Ends at</label>
              <Input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} required />
            </div>
            <div className="flex items-end gap-4 pb-1">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                Active
              </label>
              <Button type="submit" disabled={busy}>
                {busy ? "Creating…" : "Create promotion"}
              </Button>
            </div>
            {scope === "PRODUCT" && (
              <div className="sm:col-span-2 lg:col-span-3">
                <span className="text-sm font-medium">Products</span>
                <div className="mt-2 grid max-h-40 gap-1 overflow-y-auto rounded-md border border-border p-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                  {products.map((product) => (
                    <label key={product.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedProductIds.includes(product.id)}
                        onChange={(e) =>
                          setSelectedProductIds((prev) =>
                            e.target.checked ? [...prev, product.id] : prev.filter((id) => id !== product.id),
                          )
                        }
                      />
                      {product.name}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Promotion list</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : promotions.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No promotions yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Discount</th>
                    <th className="px-3 py-2">Scope</th>
                    <th className="px-3 py-2">Min qty</th>
                    <th className="px-3 py-2">Priority</th>
                    <th className="px-3 py-2">Window</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {promotions.map((p) => (
                    <tr key={p.id} className="border-b border-border">
                      <td className="px-3 py-2 font-medium">
                        {p.name}
                        <span className="block text-xs text-muted-foreground">
                          {p.products.length > 0 ? `${p.products.length} product(s)` : ""}
                          {p.variants.length > 0 ? `${p.variants.length} variant(s)` : ""}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {p.type === "PERCENTAGE_OFF" ? `${p.value}%` : `₹${p.value}`}
                        <span className="block text-xs text-muted-foreground">{TYPE_LABEL[p.type]}</span>
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="outline">{p.scope === "ALL" ? "All products" : p.scope}</Badge>
                      </td>
                      <td className="px-3 py-2">{p.minQuantity}</td>
                      <td className="px-3 py-2">{p.priority}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {new Date(p.startAt).toLocaleDateString("en-IN")} – {new Date(p.endAt).toLocaleDateString("en-IN")}
                      </td>
                      <td className="px-3 py-2">
                        <PromotionStatusBadge p={p} />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button variant="ghost" size="sm" onClick={() => void handleToggle(p)}>
                          {p.active ? "Pause" : "Activate"}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => void handleDelete(p.id)}>
                          Delete
                        </Button>
                      </td>
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

export default function PromotionsPage() {
  return (
    <RequireAuth>
      <CatalogTabs />
      <PromotionsPageInner />
    </RequireAuth>
  );
}