import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, CardContent } from "@nexus/ui";
import { catalogApi, inventoryApi } from "@/lib/api";
import { ImageGallery } from "@/components/image-gallery";
import { VariantPicker } from "@/components/variant-picker";
import { ProductCard } from "@/components/product-card";

export default async function ProductPage({ params }: { params: { slug: string } }) {
  let product;
  try {
    product = await catalogApi.getProduct(params.slug);
  } catch {
    notFound();
  }

  const variantIds = product.variants.map((v) => v.id);
  let availability: Record<string, { available: number; lowStock: boolean }> = {};
  if (variantIds.length > 0) {
    try {
      availability = await inventoryApi.getAvailability(variantIds);
    } catch {
      availability = {};
    }
  }

  return (
    <div className="container-page py-8">
      <nav className="mb-4 text-sm text-muted-foreground" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-primary">
          Home
        </Link>
        <span className="mx-2">/</span>
        <Link href="/products" className="hover:text-primary">
          Products
        </Link>
        <span className="mx-2">/</span>
        <span>{product.categoryName}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-2">
        <ImageGallery images={product.images} />
        <div>
          {product.brand && <p className="text-sm font-medium text-muted-foreground">{product.brand}</p>}
          <h1 className="mt-1 text-2xl font-bold tracking-tight">{product.name}</h1>
          <div className="mt-2 flex items-center gap-2 text-sm">
            <Badge variant={product.ratingsCount > 0 ? "success" : "secondary"}>
              {product.ratingsCount > 0 ? `${product.ratingsAvg} · ${product.ratingsCount} ratings` : "No ratings yet"}
            </Badge>
            {product.isFeatured && <Badge variant="warning">Featured</Badge>}
          </div>

          <div className="mt-6">
            <VariantPicker variants={product.variants} availability={availability} />
          </div>

          {product.shortDescription && (
            <p className="mt-6 text-sm text-muted-foreground">{product.shortDescription}</p>
          )}

          {product.attributes.length > 0 && (
            <div className="mt-6">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Key specifications
              </h2>
              <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                {product.attributes.map((attribute) => (
                  <div key={attribute.attributeId} className="flex justify-between gap-4 border-b border-border py-2">
                    <dt className="text-muted-foreground">{attribute.name}</dt>
                    <dd className="font-medium">{attribute.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>
      </div>

      {product.description && (
        <div className="mt-10">
          <h2 className="mb-3 text-lg font-semibold">Description</h2>
          <div className="max-w-3xl space-y-3 text-sm leading-relaxed text-muted-foreground">
            {product.description.split("\n").map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        </div>
      )}

      {product.related.length > 0 && (
        <div className="mt-12">
          <h2 className="mb-4 text-lg font-semibold">Related products</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
            {product.related.map((related) => (
              <ProductCard key={related.id} product={related} />
            ))}
          </div>
        </div>
      )}

      <Card className="mt-10">
        <CardContent className="flex flex-col items-start gap-1 py-6 text-sm">
          <p className="font-medium">Questions about this product?</p>
          <p className="text-muted-foreground">Chat and contact features arrive in a later phase.</p>
        </CardContent>
      </Card>
    </div>
  );
}