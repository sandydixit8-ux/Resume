import Link from "next/link";
import { Badge, Card } from "@nexus/ui";
import type { ProductSummary } from "@nexus/contracts";
import { cn } from "@nexus/ui";
import { formatINR } from "@/lib/format";

export function ProductCard({ product, className }: { product: ProductSummary; className?: string }) {
  const mrp = Number(product.mrp);
  const selling = Number(product.sellingPrice);
  const discount = mrp > 0 && selling > 0 && selling < mrp ? Math.round((1 - selling / mrp) * 100) : 0;

  return (
    <Card className={cn("group overflow-hidden", className)}>
      <Link href={`/products/${product.slug}`} className="block">
        <div className="relative aspect-square overflow-hidden bg-muted">
          {product.primaryImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.primaryImageUrl}
              alt={product.name}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
              No image
            </div>
          )}
          {discount > 0 && (
            <Badge className="absolute left-2 top-2 bg-primary text-primary-foreground">
              {discount}% off
            </Badge>
          )}
        </div>
        <div className="space-y-1 p-3">
          {product.brand && <p className="text-xs text-muted-foreground">{product.brand}</p>}
          <h3 className="line-clamp-2 text-sm font-medium">{product.name}</h3>
          <div className="flex flex-wrap items-baseline gap-2 pt-1">
            <span className="text-base font-semibold text-primary">{formatINR(product.sellingPrice)}</span>
            <span className="text-xs text-muted-foreground line-through">{formatINR(product.mrp)}</span>
          </div>
        </div>
      </Link>
    </Card>
  );
}