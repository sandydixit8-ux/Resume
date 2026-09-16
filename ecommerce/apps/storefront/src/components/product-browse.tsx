import Link from "next/link";
import { Card, CardContent, cn } from "@nexus/ui";
import { catalogApi } from "@/lib/api";
import {
  ParamBag,
  SORT_OPTIONS,
  activeSort,
  sp,
  spInt,
  withParams,
} from "@/lib/search-params";
import { FacetsSidebar } from "@/components/facets-sidebar";
import { ProductCard } from "@/components/product-card";

export async function ProductBrowse({
  params,
  path = "/products",
  title,
}: {
  params: ParamBag;
  path?: string;
  title?: string;
}) {
  const [result, categories] = await Promise.all([
    catalogApi.listProducts({
      q: sp(params, "q"),
      category: sp(params, "category"),
      brand: sp(params, "brand"),
      attrs: sp(params, "attrs"),
      sort: activeSort(params),
      priceMin: spInt(params, "priceMin"),
      priceMax: spInt(params, "priceMax"),
      page: spInt(params, "page"),
      pageSize: 24,
    }),
    catalogApi.getCategories(),
  ]);

  const { data: products, meta, facets } = result;
  const sort = activeSort(params);

  return (
    <div className="container-page py-8">
      {title && <h1 className="mb-6 text-2xl font-bold tracking-tight">{title}</h1>}
      <div className="flex flex-col gap-8 lg:flex-row">
        <FacetsSidebar params={params} path={path} facets={facets} categories={categories} />
        <div className="min-w-0 flex-1">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {meta.total} {meta.total === 1 ? "product" : "products"}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">Sort:</span>
              {SORT_OPTIONS.map((option) => (
                <Link
                  key={option.value}
                  href={withParams(params, { sort: option.value, page: null }, path)}
                  className={cn(
                    "rounded-full px-3 py-1 text-sm transition-colors",
                    sort === option.value
                      ? "bg-primary font-medium text-primary-foreground"
                      : "bg-muted text-foreground hover:bg-accent",
                  )}
                >
                  {option.label}
                </Link>
              ))}
            </div>
          </div>

          <form method="get" action={path} className="mb-6">
            <input type="hidden" name="q" value={sp(params, "q") ?? ""} />
            <input type="hidden" name="category" value={sp(params, "category") ?? ""} />
            <input type="hidden" name="brand" value={sp(params, "brand") ?? ""} />
            <input type="hidden" name="attrs" value={sp(params, "attrs") ?? ""} />
            <input type="hidden" name="sort" value={sort} />
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">Price:</span>
              <input
                type="number"
                name="priceMin"
                min={0}
                placeholder="Min"
                defaultValue={sp(params, "priceMin") ?? ""}
                className="h-9 w-24 rounded-md border border-input bg-background px-2 text-sm"
              />
              <span className="text-muted-foreground">to</span>
              <input
                type="number"
                name="priceMax"
                min={0}
                placeholder="Max"
                defaultValue={sp(params, "priceMax") ?? ""}
                className="h-9 w-24 rounded-md border border-input bg-background px-2 text-sm"
              />
              <button
                type="submit"
                className="h-9 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground"
              >
                Apply
              </button>
              {(sp(params, "priceMin") || sp(params, "priceMax")) && (
                <Link
                  href={withParams(params, { priceMin: null, priceMax: null }, path)}
                  className="text-sm text-primary hover:underline"
                >
                  Clear
                </Link>
              )}
            </div>
          </form>

          {products.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
                <p className="max-w-md text-sm text-muted-foreground">
                  No products matched your filters. Try adjusting or clearing a few filters.
                </p>
                <Link href={path} className="text-sm text-primary hover:underline">
                  Clear all filters
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}

          {meta.totalPages > 1 && (
            <nav className="mt-8 flex items-center justify-center gap-2" aria-label="Pagination">
              {meta.page > 1 && (
                <Link
                  href={withParams(params, { page: String(meta.page - 1) }, path)}
                  className="rounded-md border border-input px-3 py-2 text-sm hover:bg-accent"
                >
                  Prev
                </Link>
              )}
              {Array.from({ length: meta.totalPages }, (_, i) => i + 1)
                .filter((p) => Math.abs(p - meta.page) <= 2 || p === 1 || p === meta.totalPages)
                .map((p) => (
                  <Link
                    key={p}
                    href={withParams(params, { page: String(p) }, path)}
                    aria-current={p === meta.page ? "page" : undefined}
                    className={cn(
                      "rounded-md border px-3 py-2 text-sm",
                      p === meta.page
                        ? "border-primary bg-primary font-medium text-primary-foreground"
                        : "border-input hover:bg-accent",
                    )}
                  >
                    {p}
                  </Link>
                ))}
              {meta.page < meta.totalPages && (
                <Link
                  href={withParams(params, { page: String(meta.page + 1) }, path)}
                  className="rounded-md border border-input px-3 py-2 text-sm hover:bg-accent"
                >
                  Next
                </Link>
              )}
            </nav>
          )}
        </div>
      </div>
    </div>
  );
}