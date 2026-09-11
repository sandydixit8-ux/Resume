import Link from "next/link";
import type { Metadata } from "next";
import { Plus, Package } from "lucide-react";
import { listProducts, listProductCategories } from "@/lib/data/products";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select } from "@/components/ui/form";
import { formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Products" };
export const dynamic = "force-dynamic";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q;
  const categoryId = sp.category;
  const page = Math.max(1, Number(sp.page ?? 1));
  const [categories, { products, total }] = await Promise.all([
    listProductCategories(),
    listProducts({ q, categoryId, page }),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <form className="flex flex-1 gap-2" action="/products">
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search products or SKU..."
            aria-label="Search products"
            className="h-9 w-full min-w-0 flex-1 rounded-lg border border-[var(--input)] bg-white px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40"
          />
          <div className="hidden sm:block">
            <Select name="category" defaultValue={categoryId ?? ""} className="h-9">
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <button
            type="submit"
            className="hidden h-9 items-center rounded-lg bg-zinc-100 px-4 text-xs font-medium hover:bg-zinc-200 md:inline-flex"
          >
            Search
          </button>
        </form>
        <Link
          href="/products/new"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 py-2 text-xs font-medium text-white shadow-sm hover:bg-[var(--primary-hover)]"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Add product</span>
        </Link>
      </div>

      {products.length === 0 ? (
        <EmptyState
          icon={Package}
          title={q ? "No products match your search" : "No products yet"}
          description="Add your first product with a selling price and GST rate to start quoting and selling."
          action={
            <Link
              href="/products/new"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 py-2 text-xs font-medium text-white"
            >
              <Plus className="h-4 w-4" /> Add product
            </Link>
          }
        />
      ) : (
        <div className="rounded-xl border border-[var(--border)] bg-white shadow-sm">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="hidden sm:table-cell">Category</TableHead>
                  <TableHead className="hidden text-right md:table-cell">Price (₹)</TableHead>
                  <TableHead className="text-right">GST</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Link href={`/products/${p.id}`}>
                        <span className="block text-sm font-medium hover:underline">{p.name}</span>
                        <span className="block text-xs text-muted-foreground">{p.sku}</span>
                      </Link>
                    </TableCell>
                    <TableCell className="hidden text-xs sm:table-cell">
                      {categories.find((c) => c.id === p.category_id)?.name ?? "-"}
                    </TableCell>
                    <TableCell className="hidden text-right text-xs tabular-nums md:table-cell">
                      {formatMoney(p.selling_price)}
                    </TableCell>
                    <TableCell className="text-right text-xs">{p.tax_rate}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pagination page={page} pageSize={20} total={total} />
        </div>
      )}
    </div>
  );
}
