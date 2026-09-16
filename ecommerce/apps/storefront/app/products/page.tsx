import { ProductBrowse } from "@/components/product-browse";

export default function ProductsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  return <ProductBrowse params={searchParams} path="/products" />;
}