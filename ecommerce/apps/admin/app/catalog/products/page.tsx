"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Skeleton } from "@nexus/ui";
import type {
  BrandDto,
  CategoryNode,
  PriceHistoryEntryDto,
  PriceTierDto,
  ProductDetail,
  ProductStatus,
  ProductSummary,
} from "@nexus/contracts";
import { ApiClientError, adminCatalogApi, adminPricingApi } from "@/lib/api";
import { RequireAuth } from "@/components/require-auth";
import { CatalogTabs } from "@/components/catalog-tabs";

const STATUSES: (ProductStatus | "ALL")[] = ["ALL", "ACTIVE", "DRAFT", "PENDING_REVIEW", "OUT_OF_STOCK", "ARCHIVED", "DISABLED"];
const STATUS_LABEL: Record<string, string> = {
  ALL: "All statuses",
  ACTIVE: "Active",
  DRAFT: "Draft",
  PENDING_REVIEW: "Pending review",
  OUT_OF_STOCK: "Out of stock",
  ARCHIVED: "Archived",
  DISABLED: "Disabled",
};

function flatten(nodes: CategoryNode[], depth = 0): { node: CategoryNode; depth: number }[] {
  const out: { node: CategoryNode; depth: number }[] = [];
  for (const node of nodes) {
    out.push({ node, depth });
    out.push(...flatten(node.children, depth + 1));
  }
  return out;
}

function ProductsPageInner() {
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<ProductStatus | "ALL">("ALL");
  const [brands, setBrands] = useState<BrandDto[]>([]);
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [mrp, setMrp] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [prodStatus, setProdStatus] = useState<ProductStatus>("DRAFT");
  const [shortDescription, setShortDescription] = useState("");

  const [priceFor, setPriceFor] = useState<ProductSummary | null>(null);
  const [priceMrp, setPriceMrp] = useState("");
  const [priceSelling, setPriceSelling] = useState("");
  const [priceReason, setPriceReason] = useState("");
  const [priceHistory, setPriceHistory] = useState<PriceHistoryEntryDto[]>([]);
  const [priceBusy, setPriceBusy] = useState(false);

  const [productDetail, setProductDetail] = useState<ProductDetail | null>(null);
  const [tierVariantId, setTierVariantId] = useState("");
  const [tiers, setTiers] = useState<PriceTierDto[]>([]);
  const [tierMinQty, setTierMinQty] = useState("");
  const [tierPrice, setTierPrice] = useState("");
  const [tierBusy, setTierBusy] = useState(false);

  const catOptions = useMemo(() => flatten(categories), [categories]);

  const load = useCallback(async () => {
    setError("");
    try {
      const result = await adminCatalogApi.listProducts({
        status: status === "ALL" ? undefined : status,
        pageSize: 50,
      });
      setProducts(result.data);
      setTotal(result.meta.total);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Failed to load products");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let mounted = true;
    Promise.all([adminCatalogApi.getBrands(), adminCatalogApi.getCategories()])
      .then(([b, c]) => {
        if (!mounted) return;
        setBrands(b);
        setCategories(c);
      })
      .catch(() => {
        /* handled on load */
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
      await adminCatalogApi.createProduct({
        name,
        sku,
        categoryId,
        ...(brandId ? { brandId } : {}),
        mrp: Number(mrp),
        sellingPrice: Number(sellingPrice),
        status: prodStatus,
        ...(shortDescription ? { shortDescription } : {}),
      });
      setNotice("Product created");
      setName("");
      setSku("");
      setCategoryId("");
      setBrandId("");
      setMrp("");
      setSellingPrice("");
      setProdStatus("DRAFT");
      setShortDescription("");
      await load();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Failed to create product");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this product?")) return;
    setError("");
    try {
      await adminCatalogApi.deleteProduct(id);
      await load();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Failed to delete product");
    }
  }

  async function handleSavePrice(e: FormEvent) {
    e.preventDefault();
    if (!priceFor) return;
    setPriceBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await adminPricingApi.updateProductPrice(priceFor.id, {
        ...(priceMrp !== "" ? { mrp: Number(priceMrp) } : {}),
        ...(priceSelling !== "" ? { sellingPrice: Number(priceSelling) } : {}),
        ...(priceReason ? { reason: priceReason } : {}),
      });
      setPriceHistory(result.history);
      setNotice("Price updated");
      await load();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Failed to update price");
    } finally {
      setPriceBusy(false);
    }
  }

  async function loadTiers(variantId: string) {
    if (!variantId) {
      setTiers([]);
      return;
    }
    setError("");
    try {
      const list = await adminPricingApi.listTiers(variantId);
      setTiers(list);
    } catch (e) {
      setTiers([]);
      setError(e instanceof ApiClientError ? e.message : "Failed to load price tiers");
    }
  }

  async function handleOpenPrice(product: ProductSummary) {
    setPriceFor(product);
    setPriceMrp("");
    setPriceSelling("");
    setPriceReason("");
    setPriceHistory([]);
    setTiers([]);
    setTierMinQty("");
    setTierPrice("");
    try {
      const detail = await adminCatalogApi.getProduct(product.slug);
      setProductDetail(detail);
      const variants = detail.variants ?? [];
      if (variants.length > 0) {
        setTierVariantId(variants[0].id);
        await loadTiers(variants[0].id);
      } else {
        setTierVariantId("");
        setTiers([]);
      }
    } catch (e) {
      setProductDetail(null);
      setTierVariantId("");
      setError(e instanceof ApiClientError ? e.message : "Failed to load product");
    }
  }

  async function handleAddTier(e: FormEvent) {
    e.preventDefault();
    if (!tierVariantId) return;
    setTierBusy(true);
    setError("");
    setNotice("");
    try {
      await adminPricingApi.upsertTier(tierVariantId, {
        minQuantity: Number(tierMinQty),
        price: Number(tierPrice),
      });
      setTierMinQty("");
      setTierPrice("");
      await loadTiers(tierVariantId);
      setNotice("Price tier saved");
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Failed to save price tier");
    } finally {
      setTierBusy(false);
    }
  }

  async function handleDeleteTier(tierId: string) {
    if (!tierVariantId) return;
    if (!window.confirm("Delete this quantity tier?")) return;
    setError("");
    try {
      await adminPricingApi.deleteTier(tierVariantId, tierId);
      await loadTiers(tierVariantId);
      setNotice("Price tier deleted");
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Failed to delete price tier");
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Products</h1>
          <p className="text-sm text-muted-foreground">{total} total</p>
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as ProductStatus | "ALL")}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          aria-label="Filter by status"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>

      {error && <Alert variant="destructive">{error}</Alert>}
      {notice && <Alert variant="success">{notice}</Alert>}

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Create product</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Nexus Air 5G" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">SKU</label>
              <Input value={sku} onChange={(e) => setSku(e.target.value)} required placeholder="e.g. NM-AIR5G" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Category</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                required
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="" disabled>
                  Select category
                </option>
                {catOptions.map(({ node, depth }) => (
                  <option key={node.id} value={node.id}>
                    {"\u00A0".repeat(depth * 3)}
                    {node.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Brand</label>
              <select
                value={brandId}
                onChange={(e) => setBrandId(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">No brand</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">MRP (₹)</label>
              <Input
                type="number"
                min={0}
                value={mrp}
                onChange={(e) => setMrp(e.target.value)}
                required
                placeholder="29999"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Selling price (₹)</label>
              <Input
                type="number"
                min={0}
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value)}
                required
                placeholder="24999"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Status</label>
              <select
                value={prodStatus}
                onChange={(e) => setProdStatus(e.target.value as ProductStatus)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="DRAFT">Draft</option>
                <option value="PENDING_REVIEW">Pending review</option>
                <option value="ACTIVE">Active</option>
                <option value="OUT_OF_STOCK">Out of stock</option>
              </select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-sm font-medium">Short description</label>
              <Input
                value={shortDescription}
                onChange={(e) => setShortDescription(e.target.value)}
                placeholder="One-line summary shown on the product card"
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={busy}>
                {busy ? "Creating…" : "Create product"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {priceFor && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Edit price — {priceFor.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSavePrice} className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">MRP (₹)</label>
                <Input
                  type="number"
                  min={0}
                  value={priceMrp}
                  onChange={(e) => setPriceMrp(e.target.value)}
                  placeholder={priceFor.mrp}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Selling price (₹)</label>
                <Input
                  type="number"
                  min={0}
                  value={priceSelling}
                  onChange={(e) => setPriceSelling(e.target.value)}
                  placeholder={priceFor.sellingPrice}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Reason</label>
                <Input value={priceReason} onChange={(e) => setPriceReason(e.target.value)} placeholder="Seasonal promotion" />
              </div>
              <div className="flex items-end gap-2">
                <Button type="submit" disabled={priceBusy}>
                  {priceBusy ? "Saving…" : "Save price"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setPriceFor(null)}>
                  Close
                </Button>
              </div>
            </form>
            {priceHistory.length > 0 && (
              <div className="mt-4 border-t border-border pt-4">
                <h3 className="mb-2 text-sm font-semibold">Price history</h3>
                <div className="max-h-48 space-y-1 overflow-y-auto text-sm">
                  {priceHistory.map((entry) => (
                    <div key={entry.id} className="flex items-center gap-3 border-b border-border py-1">
                      <span className="w-28 font-mono text-xs">{entry.fieldName}</span>
                      <span className="text-muted-foreground line-through">₹{entry.fromValue}</span>
                      <span aria-hidden="true">→</span>
                      <span className="font-medium">₹{entry.toValue}</span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {new Date(entry.createdAt).toLocaleString("en-IN")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(productDetail?.variants ?? []).length > 0 ? (
              <div className="mt-4 border-t border-border pt-4">
                <h3 className="mb-2 text-sm font-semibold">Quantity price tiers</h3>
                <div className="mb-3 flex items-center gap-3">
                  <label className="text-sm font-medium">Variant</label>
                  <select
                    value={tierVariantId}
                    onChange={(e) => {
                      setTierVariantId(e.target.value);
                      void loadTiers(e.target.value);
                    }}
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {(productDetail?.variants ?? []).map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} — ₹{v.price}
                      </option>
                    ))}
                  </select>
                </div>
                {tiers.length > 0 && (
                  <div className="mb-3 space-y-1 text-sm">
                    {tiers.map((tier) => (
                      <div key={tier.id} className="flex items-center gap-3 border-b border-border py-1">
                        <span className="font-mono text-xs">≥ {tier.minQuantity} qty</span>
                        <span className="font-medium">₹{tier.price}</span>
                        <Button type="button" variant="ghost" size="sm" className="ml-auto" onClick={() => void handleDeleteTier(tier.id)}>
                          Delete
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                <form onSubmit={handleAddTier} className="flex flex-wrap items-end gap-3">
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Min quantity</label>
                    <Input
                      type="number"
                      min={2}
                      step={1}
                      value={tierMinQty}
                      onChange={(e) => setTierMinQty(e.target.value)}
                      required
                      placeholder="2+"
                      className="w-28"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Tier price (₹)</label>
                    <Input
                      type="number"
                      min={0}
                      value={tierPrice}
                      onChange={(e) => setTierPrice(e.target.value)}
                      required
                      placeholder="21999"
                      className="w-32"
                    />
                  </div>
                  <Button type="submit" disabled={tierBusy}>
                    {tierBusy ? "Saving…" : "Add / update tier"}
                  </Button>
                </form>
              </div>
            ) : productDetail ? (
              <p className="mt-4 border-t border-border pt-4 text-sm text-muted-foreground">
                This product has no variants to price.
              </p>
            ) : (
              <p className="mt-4 border-t border-border pt-4 text-sm text-muted-foreground">Loading variants…</p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Product list</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : products.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No products match this filter.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">SKU</th>
                    <th className="px-3 py-2">Brand</th>
                    <th className="px-3 py-2">Price</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product.id} className="border-b border-border">
                      <td className="px-3 py-2 font-medium">{product.name}</td>
                      <td className="px-3 py-2 font-mono text-xs">{product.id.slice(0, 8)}</td>
                      <td className="px-3 py-2">{product.brand ?? "—"}</td>
                      <td className="px-3 py-2">
                        ₹{product.sellingPrice}
                        {Number(product.mrp) > Number(product.sellingPrice) && (
                          <span className="ml-1 text-xs text-muted-foreground line-through">₹{product.mrp}</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant={product.status === "ACTIVE" ? "success" : "secondary"}>{product.status}</Badge>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void handleOpenPrice(product)}
                        >
                          Edit price
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => void handleDelete(product.id)}>
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

export default function ProductsPage() {
  return (
    <RequireAuth>
      <CatalogTabs />
      <ProductsPageInner />
    </RequireAuth>
  );
}