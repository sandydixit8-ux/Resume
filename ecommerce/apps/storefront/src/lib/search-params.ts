export type ProductSort = "relevance" | "newest" | "price-asc" | "price-desc" | "rating" | "popular";

export type ParamBag = Record<string, string | string[] | undefined>;

export function sp(params: ParamBag, key: string): string | undefined {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export function spInt(params: ParamBag, key: string): number | undefined {
  const value = Number(sp(params, key));
  return Number.isInteger(value) && value > 0 ? value : undefined;
}

export function withParams(params: ParamBag, updates: Record<string, string | null>, path = "/products"): string {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      if (value.length === 1) next.set(key, value[0]);
      else value.forEach((item) => next.append(key, item));
    } else if (value !== undefined && value !== null) {
      next.set(key, value);
    }
  }
  for (const [key, value] of Object.entries(updates)) {
    if (value === null) next.delete(key);
    else next.set(key, value);
  }
  const qs = next.toString();
  return qs ? `${path}?${qs}` : path;
}

export function currentAttrs(params: ParamBag): string[] {
  const value = sp(params, "attrs");
  if (!value) return [];
  return value.split(",").filter(Boolean);
}

export function toggleAttrPair(existing: string[], pair: string): string {
  const rest = existing.filter((p) => p.split(":")[0] !== pair.split(":")[0]);
  return rest.concat(pair).join(",");
}

export function attrPairFrom(existing: string[], pair: string): string {
  return existing.join(",");
}

export const SORT_OPTIONS: { value: ProductSort; label: string }[] = [
  { value: "relevance", label: "Relevance" },
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "rating", label: "Rating" },
  { value: "popular", label: "Popularity" },
];

export function activeSort(params: ParamBag): ProductSort {
  const value = sp(params, "sort");
  return (SORT_OPTIONS.some((o) => o.value === value) ? value : "relevance") as ProductSort;
}