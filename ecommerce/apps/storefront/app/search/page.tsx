import { ProductBrowse } from "@/components/product-browse";

export default function SearchPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const query = typeof searchParams.q === "string" ? searchParams.q.trim() : "";
  return (
    <ProductBrowse
      params={searchParams}
      path="/search"
      title={query ? `Results for "${query}"` : "Search"}
    />
  );
}