import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { ReindexResultDto, SearchStatusDto } from "@nexus/contracts";

const COLLECTION = "products";

const SCHEMA = {
  name: COLLECTION,
  fields: [
    { name: "id", type: "string" as const },
    { name: "name", type: "string" as const, sort: true as const },
    { name: "slug", type: "string" as const },
    { name: "sku", type: "string" as const },
    { name: "brand", type: "string" as const, facet: true as const, optional: true as const },
    { name: "brandId", type: "string" as const, facet: false as const, optional: true as const },
    { name: "category", type: "string" as const, facet: true as const, optional: true as const },
    { name: "categoryId", type: "string" as const, facet: false as const, optional: true as const },
    { name: "price", type: "float" as const },
    { name: "mrp", type: "float" as const },
    { name: "status", type: "string" as const, facet: true as const },
    { name: "imageUrl", type: "string" as const, optional: true as const },
    { name: "shortDescription", type: "string" as const, optional: true as const },
    { name: "description", type: "string" as const, optional: true as const },
    { name: "salesCount", type: "int32" as const },
    { name: "rating", type: "float" as const },
    { name: "createdAt", type: "int64" as const, sort: true as const },
  ],
  default_sorting_field: "name",
  token_separators: ["-", "_"],
  symbols_to_index: ["@"],
};

type TypesenseClient = import("typesense").Client;

@Injectable()
export class SearchService implements OnModuleInit {
  private readonly logger = new Logger(SearchService.name);
  private client: TypesenseClient | null = null;
  private healthy = false;
  private lastHealthCheck = 0;
  private healthCheckIntervalMs = 30_000;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  get enabled(): boolean {
    return Boolean(this.config.get<string>("TYPESENSE_HOST"));
  }

  get isHealthy(): boolean {
    return this.enabled && this.healthy;
  }

  async onModuleInit() {
    if (!this.enabled) {
      this.logger.log("Typesense disabled (TYPESENSE_HOST not set) — falling back to Postgres FTS");
      return;
    }
    await this.initClient();
  }

  private async initClient(): Promise<void> {
    try {
      const { Client } = await import("typesense");
      const host = this.config.get<string>("TYPESENSE_HOST")!;
      const port = this.config.get<number>("TYPESENSE_PORT") ?? 8108;
      const protocol = this.config.get<string>("TYPESENSE_PROTOCOL") ?? "https";
      const apiKey = this.config.get<string>("TYPESENSE_ADMIN_API_KEY")!;

      this.client = new Client({
        nodes: [{ host, port, protocol: protocol as "http" | "https" }],
        apiKey,
        connectionTimeoutSeconds: 5,
        numRetries: 3,
        retryIntervalSeconds: 1,
        logLevel: "warn",
      });

      await this.healthCheck();
      if (this.healthy) {
        this.logger.log(`Typesense connected: ${protocol}://${host}:${port}`);
        await this.ensureCollection();
      }
    } catch (err) {
      this.healthy = false;
      this.logger.warn(`Typesense init failed — falling back to Postgres FTS: ${err instanceof Error ? err.message : err}`);
    }
  }

  async healthCheck(): Promise<boolean> {
    const now = Date.now();
    if (now - this.lastHealthCheck < this.healthCheckIntervalMs) return this.healthy;
    this.lastHealthCheck = now;

    if (!this.client) {
      this.healthy = false;
      return false;
    }
    try {
      await this.client.health.retrieve();
      this.healthy = true;
      return true;
    } catch {
      this.healthy = false;
      return false;
    }
  }

  private async ensureCollection(): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.collections(COLLECTION).retrieve();
    } catch (err: any) {
      if (err?.status === 404 || err?.httpStatus === 404) {
        this.logger.log("Creating Typesense products collection");
        await this.client.collections().create(SCHEMA as any);
      } else {
        throw err;
      }
    }
  }

  async status(): Promise<SearchStatusDto> {
    const host = this.config.get<string>("TYPESENSE_HOST") ?? "";
    const healthy = await this.healthCheck();
    let documentCount: number | undefined;
    if (healthy && this.client) {
      try {
        const stats = await this.client.collections(COLLECTION).retrieve();
        documentCount = (stats as any).num_documents;
      } catch {
        /* ignore */
      }
    }
    return {
      enabled: this.enabled,
      healthy,
      host: host ? `${host}:${this.config.get("TYPESENSE_PORT")}` : "",
      collection: COLLECTION,
      documentCount,
      message: !this.enabled
        ? "Typesense disabled (TYPESENSE_HOST not set)"
        : healthy
          ? "Connected"
          : "Connection failed — falling back to Postgres FTS",
    };
  }

  async search(q: string): Promise<{ ids: string[]; total: number }> {
    if (!(await this.healthCheck())) return { ids: [], total: 0 };
    try {
      const res = await this.client!.collections(COLLECTION).documents().search({
        q,
        query_by: "name,brand,sku,shortDescription,description",
        per_page: 1000,
        page: 1,
        exclude_fields: "shortDescription,description",
      });
      const ids = (res.hits ?? []).map((h: any) => (h.document as any).id as string);
      return { ids, total: res.found ?? 0 };
    } catch (err) {
      this.healthy = false;
      this.logger.warn(`Typesense search failed — falling back to Postgres: ${err instanceof Error ? err.message : err}`);
      return { ids: [], total: 0 };
    }
  }

  async reindex(): Promise<ReindexResultDto> {
    const status = await this.status();
    if (!this.enabled || !this.healthy) {
      return { indexed: 0, skipped: 0, status };
    }

    await this.ensureCollection();

    const products = await this.prisma.product.findMany({
      where: { status: "ACTIVE", deletedAt: null },
      include: {
        brand: true,
        category: true,
        images: { where: { isPrimary: true }, take: 1 },
      },
    });

    if (products.length === 0) return { indexed: 0, skipped: 0, status };

    const docs = products.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      sku: p.sku,
      brand: p.brand?.name ?? null,
      brandId: p.brandId ?? null,
      category: p.category?.name ?? null,
      categoryId: p.categoryId ?? null,
      price: Number(p.sellingPrice),
      mrp: Number(p.mrp),
      status: p.status,
      imageUrl: p.images?.[0]?.url ?? null,
      shortDescription: p.shortDescription ?? null,
      description: p.description ?? null,
      salesCount: p.salesCount,
      rating: Number(p.ratingsAvg),
      createdAt: Math.floor(p.createdAt.getTime() / 1000),
    }));

    try {
      const res = await this.client!.collections(COLLECTION).documents().import(docs as any[], { action: "upsert" });
      const succeeded = res.filter((r) => r.success).length;
      this.logger.log(`Typesense reindex: ${succeeded}/${docs.length} docs indexed`);
      const updatedStatus = await this.status();
      return {
        indexed: succeeded,
        skipped: docs.length - succeeded,
        status: updatedStatus,
      };
    } catch (err) {
      this.logger.error(`Typesense reindex failed: ${err instanceof Error ? err.message : err}`);
      const failStatus = await this.status();
      return { indexed: 0, skipped: docs.length, status: failStatus };
    }
  }

  async indexProduct(id: string): Promise<void> {
    if (!(await this.healthCheck())) return;
    try {
      const product = await this.prisma.product.findUnique({
        where: { id },
        include: {
          brand: true,
          category: true,
          images: { where: { isPrimary: true }, take: 1 },
        },
      });
      if (!product || product.status !== "ACTIVE" || product.deletedAt) {
        await this.removeProduct(id);
        return;
      }
      await this.client!.collections(COLLECTION).documents().upsert({
        id: product.id,
        name: product.name,
        slug: product.slug,
        sku: product.sku,
        brand: product.brand?.name ?? null,
        brandId: product.brandId ?? null,
        category: product.category?.name ?? null,
        categoryId: product.categoryId ?? null,
        price: Number(product.sellingPrice),
        mrp: Number(product.mrp),
        status: product.status,
        imageUrl: product.images?.[0]?.url ?? null,
        shortDescription: product.shortDescription ?? null,
        description: product.description ?? null,
        salesCount: product.salesCount,
        rating: Number(product.ratingsAvg),
        createdAt: Math.floor(product.createdAt.getTime() / 1000),
      });
    } catch (err) {
      this.logger.warn(`Typesense index product ${id} failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  async removeProduct(id: string): Promise<void> {
    if (!(await this.healthCheck())) return;
    try {
      await this.client!.collections(COLLECTION).documents(id).delete();
    } catch (err: any) {
      if (err?.httpStatus === 404) return;
      this.logger.warn(`Typesense remove product ${id} failed: ${err instanceof Error ? err.message : err}`);
    }
  }
}
