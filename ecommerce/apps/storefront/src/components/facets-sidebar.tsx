import Link from "next/link";
import { cn } from "@nexus/ui";
import type { CategoryNode, Facets } from "@nexus/contracts";
import {
  ParamBag,
  currentAttrs,
  sp,
  toggleAttrPair,
  withParams,
} from "@/lib/search-params";

function flattenCategories(nodes: CategoryNode[], depth = 0): { node: CategoryNode; depth: number }[] {
  const out: { node: CategoryNode; depth: number }[] = [];
  for (const node of nodes) {
    out.push({ node, depth });
    out.push(...flattenCategories(node.children, depth + 1));
  }
  return out;
}

export function FacetsSidebar({
  params,
  path,
  facets,
  categories,
}: {
  params: ParamBag;
  path: string;
  facets: Facets;
  categories: CategoryNode[];
}) {
  const category = sp(params, "category");
  const brand = sp(params, "brand");
  const attrs = currentAttrs(params);

  return (
    <aside className="lg:w-64 lg:shrink-0">
      <div className="space-y-6">
        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Categories
          </h2>
          <ul className="space-y-1">
            <li>
              {category ? (
                <Link
                  href={withParams(params, { category: null }, path)}
                  className="text-sm text-primary hover:underline"
                >
                  All Categories
                </Link>
              ) : (
                <span className="text-sm font-medium">All Categories</span>
              )}
            </li>
            {flattenCategories(categories).map(({ node, depth }) => (
              <li key={node.id}>
                <Link
                  href={withParams(params, { category: node.slug }, path)}
                  className={cn(
                    "block text-sm hover:text-primary",
                    category === node.slug ? "font-medium text-primary" : "text-foreground",
                  )}
                  style={{ paddingLeft: `${depth * 12}px` }}
                >
                  {node.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {facets.brands.length > 0 && (
          <div>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Brand</h2>
            <ul className="space-y-1">
              {brand && (
                <li>
                  <Link
                    href={withParams(params, { brand: null }, path)}
                    className="text-sm text-primary hover:underline"
                  >
                    All Brands
                  </Link>
                </li>
              )}
              {facets.brands.map((facet) => (
                <li key={facet.slug}>
                  <Link
                    href={withParams(params, { brand: facet.slug }, path)}
                    className={cn(
                      "text-sm hover:text-primary",
                      brand === facet.slug ? "font-medium text-primary" : "text-foreground",
                    )}
                  >
                    {facet.name} ({facet.count})
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {facets.attributes.map((facet) => (
          <div key={facet.id}>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {facet.name}
            </h2>
            <ul className="space-y-1">
              {attrs.some((p) => p.split(":")[0] === facet.code) && (
                <li>
                  <Link
                    href={withParams(
                      params,
                      { attrs: attrs.filter((p) => p.split(":")[0] !== facet.code).join(",") || null },
                      path,
                    )}
                    className="text-sm text-primary hover:underline"
                  >
                    All {facet.name}
                  </Link>
                </li>
              )}
              {facet.values.map((value) => {
                const pair = `${facet.code}:${value.slug}`;
                const enabled = attrs.includes(pair);
                const nextAttrs = enabled
                  ? attrs.filter((p) => p.split(":")[0] !== facet.code).join(",")
                  : toggleAttrPair(attrs, pair);
                return (
                  <li key={value.slug}>
                    <Link
                      href={withParams(params, { attrs: nextAttrs || null }, path)}
                      className={cn(
                        "text-sm hover:text-primary",
                        enabled ? "font-medium text-primary" : "text-foreground",
                      )}
                    >
                      {value.value} ({value.count})
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </aside>
  );
}