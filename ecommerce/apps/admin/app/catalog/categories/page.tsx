"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Skeleton } from "@nexus/ui";
import type { CategoryNode } from "@nexus/contracts";
import { ApiClientError, adminCatalogApi } from "@/lib/api";
import { RequireAuth } from "@/components/require-auth";
import { CatalogTabs } from "@/components/catalog-tabs";

function flatten(nodes: CategoryNode[], depth = 0): { node: CategoryNode; depth: number }[] {
  const out: { node: CategoryNode; depth: number }[] = [];
  for (const node of nodes) {
    out.push({ node, depth });
    out.push(...flatten(node.children, depth + 1));
  }
  return out;
}

function CategoriesPageInner() {
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);

  const rows = useMemo(() => flatten(categories, 0), [categories]);

  const load = useCallback(async () => {
    setError("");
    try {
      setCategories(await adminCatalogApi.getCategories());
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Failed to load categories");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await adminCatalogApi.createCategory({
        name,
        ...(parentId ? { parentId } : {}),
        ...(imageUrl ? { imageUrl } : {}),
        ...(description ? { description } : {}),
        isActive,
      });
      setNotice("Category created");
      setName("");
      setParentId("");
      setImageUrl("");
      setDescription("");
      await load();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Failed to create category");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this category? Children and products must be moved first.")) return;
    setError("");
    try {
      await adminCatalogApi.deleteCategory(id);
      await load();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Failed to delete category");
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Categories</h1>
        <p className="text-sm text-muted-foreground">{rows.length} categories</p>
      </div>

      {error && <Alert variant="destructive">{error}</Alert>}
      {notice && <Alert variant="success">{notice}</Alert>}

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Create category</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Mobile Phones" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Parent</label>
              <select
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">None (top level)</option>
                {rows.map(({ node, depth }) => (
                  <option key={node.id} value={node.id}>
                    {"\u00A0".repeat(depth * 3)}
                    {node.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Image URL</label>
              <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-sm font-medium">Description</label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                Active
              </label>
            </div>
            <div className="flex items-end lg:col-start-3">
              <Button type="submit" disabled={busy}>
                {busy ? "Creating…" : "Create category"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Category tree</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No categories yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Path</th>
                    <th className="px-3 py-2">Products</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ node, depth }) => (
                    <tr key={node.id} className="border-b border-border">
                      <td className="px-3 py-2" style={{ paddingLeft: `${12 + depth * 16}px` }}>
                        {depth > 0 ? "└ " : ""}
                        {node.name}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{node.path}</td>
                      <td className="px-3 py-2">{node.productCount}</td>
                      <td className="px-3 py-2">
                        <Badge variant={node.isActive ? "success" : "secondary"}>
                          {node.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button variant="ghost" size="sm" onClick={() => void handleDelete(node.id)}>
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

export default function CategoriesPage() {
  return (
    <RequireAuth>
      <CatalogTabs />
      <CategoriesPageInner />
    </RequireAuth>
  );
}