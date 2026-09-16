import Link from "next/link";
import { Button, Card, CardContent } from "@nexus/ui";

export default function HomePage() {
  return (
    <div className="space-y-12 py-6">
      <section aria-label="Hero" className="container-page">
        <div className="rounded-2xl bg-gradient-to-r from-primary to-accent px-6 py-16 text-primary-foreground sm:px-12">
          <h1 className="max-w-2xl text-3xl font-bold sm:text-4xl">
            Everything you need, from every category.
          </h1>
          <p className="mt-3 max-w-xl text-sm text-primary-foreground/80 sm:text-base">
            Discover, compare and buy across thousands of products — with fast delivery and
            easy returns.
          </p>
          <Link href="/search" className="mt-6 inline-block">
            <Button size="lg" variant="secondary">
              Start shopping
            </Button>
          </Link>
        </div>
      </section>

      <section aria-label="Category navigation" className="container-page">
        <h2 className="text-lg font-semibold">Browse by category</h2>
        <Card className="mt-4">
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <p className="max-w-md text-sm text-muted-foreground">
              Category tiles are configured from the admin panel and will appear here in Phase 2.
            </p>
          </CardContent>
        </Card>
      </section>

      <section aria-label="Coming soon" className="container-page">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <h2 className="text-lg font-semibold">Catalog coming soon</h2>
            <p className="max-w-md text-sm text-muted-foreground">
              Product catalog, search, cart and checkout are under construction (Phase 2–3).
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}