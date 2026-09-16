"use client";

import Link from "next/link";
import { useCart } from "@/providers/cart-provider";

export function CartBadge() {
  const { itemCount, ready } = useCart();
  return (
    <Link href="/cart" aria-label={`Cart, ${itemCount} item${itemCount === 1 ? "" : "s"}`}>
      <span className="relative inline-flex items-center rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
        Cart
        {ready && itemCount > 0 && (
          <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">
            {itemCount}
          </span>
        )}
      </span>
    </Link>
  );
}