import { Injectable } from "@nestjs/common";
import { Collection, Prisma } from "@prisma/client";
import { CollectionDetail, CollectionDto, PaginationMeta, ProductSummary } from "@nexus/contracts";
import { PrismaService } from "../../prisma/prisma.service";
import { slugify } from "../../common/utils/slugify";
import { NotFoundException } from "../../common/exceptions/app.exception";

export type CollectionCreateInput = {
  name: string;
  slug?: string;
  type?: string;
  rules?: Record<string, unknown>;
  seoTitle?: string;
  seoDescription?: string;
  isActive?: boolean;
  productIds?: string[];
};

@Injectable()
export class CollectionsService {
  constructor(private readonly prisma: PrismaService) {}

  async uniqueSlug(name: string, preferred?: string, excludeId?: string): Promise<string> {
    const base = slugify(preferred?.trim() || name);
    let slug = base;
    let i = 2;
    while (await this.prisma.collection.findFirst({ where: { slug, id: { not: excludeId } } })) {
      slug = `${base}-${i++}`;
    }
    return slug;
  }

  async list(includeInactive = false): Promise<CollectionDto[]> {
    const collections = await this.prisma.collection.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { createdAt: "desc" },
    });
    const [counts, covers] = await Promise.all([
      this.prisma.collectionProduct.groupBy({
        by: ["collectionId"],
        where: { product: { status: "ACTIVE", deletedAt: null } },
        _count: { _all: true },
      }),
      this.prisma.collectionProduct.findMany({
        where: { collectionId: { in: collections.map((c) => c.id) } },
        include: { product: { include: { images: { where: { isPrimary: true }, take: 1 } } } },
        orderBy: { position: "asc" },
      }),
    ]);
    const diff = counts as unknown as { collectionId: string; _count: { _all: number } }[];
    const countMap = new Map(diff.map((g) => [g.collectionId, g._count._all]));
    const coverMap = new Map<string, string>();
    for (const row of covers) {
      const url = row.product.images[0]?.url;
      if (url && !coverMap.has(row.collectionId)) coverMap.set(row.collectionId, url);
    }
    return collections.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      type: c.type,
      isActive: c.isActive,
      coverImageUrl: coverMap.get(c.id),
      productCount: countMap.get(c.id) ?? 0,
    }));
  }

  async detail(slug: string, page = 1, pageSize = 12): Promise<CollectionDetail & { products: ProductSummary[]; meta: PaginationMeta }> {
    const collection = await this.prisma.collection.findUnique({ where: { slug } });
    if (!collection || !collection.isActive) throw NotFoundException("Collection");

    const where = { collectionId: collection.id, product: { status: "ACTIVE" as const, deletedAt: null } };
    const [total, rows] = await Promise.all([
      this.prisma.collectionProduct.count({ where }),
      this.prisma.collectionProduct.findMany({
        where,
        include: { product: { include: { brand: true, images: { where: { isPrimary: true }, take: 1 } } } },
        orderBy: { position: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      id: collection.id,
      name: collection.name,
      slug: collection.slug,
      type: collection.type,
      isActive: collection.isActive,
      seoTitle: collection.seoTitle ?? undefined,
      seoDescription: collection.seoDescription ?? undefined,
      coverImageUrl: rows[0]?.product.images[0]?.url,
      productCount: total,
      products: rows.map((r) => ({
        id: r.product.id,
        name: r.product.name,
        slug: r.product.slug,
        brand: r.product.brand?.name,
        primaryImageUrl: r.product.images[0]?.url,
        mrp: r.product.mrp.toString(),
        sellingPrice: r.product.sellingPrice.toString(),
        ratingsAvg: r.product.ratingsAvg.toString(),
        ratingsCount: r.product.ratingsCount,
        salesCount: r.product.salesCount,
        isFeatured: r.product.isFeatured,
        publishedAt: r.product.publishedAt?.toISOString(),
      })),
      meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    };
  }

  async create(input: CollectionCreateInput): Promise<CollectionDto> {
    const collection = await this.prisma.collection.create({
      data: {
        name: input.name,
        slug: await this.uniqueSlug(input.name, input.slug),
        type: input.type ?? "manual",
        rules: input.rules as unknown as Prisma.InputJsonValue ?? undefined,
        seoTitle: input.seoTitle ?? null,
        seoDescription: input.seoDescription ?? null,
        isActive: input.isActive ?? true,
      },
    });
    if (input.productIds?.length) {
      await this.setProducts(collection.id, input.productIds);
    }
    const dto = (await this.list(true)).find((c) => c.id === collection.id);
    return dto ?? this.toDto(collection, 0);
  }

  private toDto(c: Collection, productCount: number): CollectionDto {
    return { id: c.id, name: c.name, slug: c.slug, type: c.type, isActive: c.isActive, productCount };
  }

  async update(id: string, input: Partial<Omit<CollectionCreateInput, "productIds">>): Promise<CollectionDto> {
    const existing = await this.prisma.collection.findUnique({ where: { id } });
    if (!existing) throw NotFoundException("Collection");
    const collection = await this.prisma.collection.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.slug !== undefined && input.slug !== existing.slug
          ? { slug: await this.uniqueSlug(input.slug, input.slug, id) }
          : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.rules !== undefined ? { rules: input.rules as unknown as Prisma.InputJsonValue } : {}),
        ...(input.seoTitle !== undefined ? { seoTitle: input.seoTitle ?? null } : {}),
        ...(input.seoDescription !== undefined ? { seoDescription: input.seoDescription ?? null } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });
    return this.toDto(collection, await this.prisma.collectionProduct.count({ where: { collectionId: id } }));
  }

  async setProducts(id: string, productIds: string[]): Promise<CollectionDto> {
    const existing = await this.prisma.collection.findUnique({ where: { id } });
    if (!existing) throw NotFoundException("Collection");
    const valid = productIds.length
      ? await this.prisma.product.count({ where: { id: { in: productIds } } })
      : 0;
    if (valid !== productIds.length) throw NotFoundException("Product");
    await this.prisma.$transaction([
      this.prisma.collectionProduct.deleteMany({ where: { collectionId: id } }),
      ...productIds.map((productId, idx) =>
        this.prisma.collectionProduct.create({ data: { collectionId: id, productId, position: idx } }),
      ),
    ]);
    return this.toDto(existing, productIds.length);
  }

  async remove(id: string): Promise<void> {
    const existing = await this.prisma.collection.findUnique({ where: { id } });
    if (!existing) throw NotFoundException("Collection");
    await this.prisma.$transaction([
      this.prisma.collectionProduct.deleteMany({ where: { collectionId: id } }),
      this.prisma.collection.delete({ where: { id } }),
    ]);
  }
}