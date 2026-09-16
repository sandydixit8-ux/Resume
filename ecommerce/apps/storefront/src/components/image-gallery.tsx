"use client";

import { useState } from "react";
import { cn } from "@nexus/ui";
import type { ProductImageDto } from "@nexus/contracts";

export function ImageGallery({ images }: { images: ProductImageDto[] }) {
  const [active, setActive] = useState(0);
  const list = images.length > 0 ? images : [];
  const current = list[Math.min(active, Math.max(0, list.length - 1))];

  return (
    <div>
      <div className="flex aspect-square items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
        {current ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={current.url} alt={current.alt ?? "Product image"} className="h-full w-full object-contain" />
        ) : (
          <span className="text-sm text-muted-foreground">No image</span>
        )}
      </div>
      {list.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {list.map((image, index) => (
            <button
              key={image.id}
              type="button"
              onClick={() => setActive(index)}
              className={cn(
                "h-16 w-16 shrink-0 overflow-hidden rounded-md border bg-muted",
                index === active ? "border-primary ring-2 ring-primary" : "border-border",
              )}
              aria-label={`View image ${index + 1}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.url} alt={image.alt ?? ""} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}