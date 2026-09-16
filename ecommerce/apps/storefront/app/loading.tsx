import { Skeleton } from "@nexus/ui";

export default function Loading() {
  return (
    <div className="container-page space-y-6 py-6" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-48 w-full rounded-2xl" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-44" />
        ))}
      </div>
    </div>
  );
}