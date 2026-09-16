import { Injectable, Logger } from "@nestjs/common";
import { Prisma, Product, ProductStatus } from "@prisma/client";
import {
  Facets,
  PaginationMeta,
  PriceTierDto,
  ProductDetail,
  ProductListResult,
  ProductSummary,
  PromoMetaDto,
  PromotionScopeValue,
  PromotionTypeValue,
} from "@nexus/contracts";
import { PrismaService } from "../../prisma/prisma.service";
import { slugify } from "../../common/utils/slugify";
import { SearchService } from "../search/search.service";
import {
  ConflictException,
  NotFoundException,
  ValidationException,
} from "../../common/exceptions/app.exception";

export type ProductSort = "relevance" | "newest" | "price-asc" | "price-desc" | "rating" | "popular";

export type ProductAttributeInput = {
  attributeId: string;
  attributeValueId?: string;
  valueText?: string;
  valueNumber?: number;
};

export type ProductImageInput = {
  url: string;
  alt?: string;
  position?: number;
  isPrimary?: boolean;
};

export type ProductVariantInput = {
  sku: string;
  name: string;
  price: number;
  mrp: number;
  position?: number;
  isActive?: boolean;
  attributes?: { attributeId: string; attributeValueId?: string; rawValue?: string }[];
  images?: ProductImageInput[];
};

export type ProductCreateInput = {
  sku: string;
  name: string;
  slug?: string;
  shortDescription?: string;
  description?: string;
  brandId?: string;
  categoryId: string;
  status?: ProductStatus;
  mrp: number;
  sellingPrice: number;
  currency?: string;
  weightG?: number;
  lengthMm?: number;
  widthMm?: number;
  heightMm?: number;
  returnEligible?: boolean;
  isFeatured?: boolean;
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string;
  images?: ProductImageInput[];
  attributes?: ProductAttributeInput[];
  variants?: ProductVariantInput[];
};

export type ProductUpdateInput = Partial<
  Omit<ProductCreateInput, "variants" | "images" | "attributes" | "slug">
> & {
  slug?: string;
  images?: ProductImageInput[];
  attributes?: ProductAttributeInput[];
};

export type ProductListQueryInput = {
  q?: string;
  category?: string;
  brand?: string;
  attrs?: string;
  sort?: ProductSort;
  priceMin?: number;
  priceMax?: number;
  page: number;
  pageSize: number;
};

const DECIMAL = { precision: 12, scale: 2 };

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly searchService: SearchService,
  ) {}

  async uniqueSlug(name: string, preferred?: string, excludeId?: string): Promise<string> {
    const base = slugify(preferred?.trim() || name);
    let slug = base;
    let i = 2;
    while (await this.prisma.product.findFirst({ where: { slug, id: { not: excludeId } } })) {
      slug = `${base}-${i++}`;
    }
    return slug;
  }

  private money(value: number): Prisma.Decimal {
    if (!Number.isFinite(value) || value < 0) {
      throw ValidationException({ value: "Price must be a non-negative number" });
    }
    return new Prisma.Decimal(value.toFixed(2));
  }

  async list(query: ProductListQueryInput): Promise<ProductListResult> {
    const page = Math.max(1, query.page || 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize || 20));

    const search = query.q?.trim()
      ? await this.executeSearch(query.q, 0, 1000)
      : null;

    const where = await this.buildWhere(query, true);
    if (search?.ids.length) where.id = { in: search.ids };

    const facetWhere = await this.buildFacetWhere(query);
    if (search?.ids.length) facetWhere.id = { in: search.ids };

    const sort = query.sort;
    const ranked = Boolean(search && (!sort || sort === "relevance"));

    const total = await this.prisma.product.count({ where });
    let items: (Product & { brand?: { name: string; slug: string } | null; images?: { url: string }[] })[];

    if (ranked) {
      const offset = (page - 1) * pageSize;
      const pageIds = search!.ids.slice(offset, offset + pageSize);
      const rows = await this.prisma.product.findMany({
        where: { ...where, id: { in: pageIds } },
        include: { brand: true, images: { where: { isPrimary: true }, take: 1 } },
      });
      const byId = new Map(rows.map((r) => [r.id, r]));
      items = pageIds.map((id) => byId.get(id)).filter((r): r is NonNullable<typeof r> => Boolean(r));
    } else {
      items = await this.prisma.product.findMany({
        where,
        include: { brand: true, images: { where: { isPrimary: true }, take: 1 } },
        orderBy: this.orderBy(sort),
        skip: (page - 1) * pageSize,
        take: pageSize,
      });
    }

    const facets =
      search && total === 0
        ? { brands: [], attributes: [], price: { min: "0", max: "0" } }
        : await this.facets(facetWhere);

    const meta: PaginationMeta = {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
    return { data: items.map((p) => this.toSummary(p)), meta, facets };
  }

  private async executeSearch(q: string, offset: number, limit: number): Promise<{ ids: string[]; total: number }> {
    if (this.searchService.isHealthy) {
      const result = await this.searchService.search(q);
      if (result.ids.length > 0 || result.total > 0) {
        this.logger.debug(`Typesense search for "${q}": ${result.total} results`);
        return result;
      }
      this.logger.debug(`Typesense returned empty for "${q}" — falling back to Postgres FTS`);
    }
    return this.searchRanked(q, offset, limit);
  }

  async detail(slug: string): Promise<ProductDetail> {
    const product = await this.prisma.product.findUnique({
      where: { slug },
      include: {
        brand: true,
        category: true,
        images: { orderBy: [{ position: "asc" }, { isPrimary: "desc" }] },
        videos: { orderBy: { position: "asc" } },
        variants: {
          include: {
            variantAttributeValues: {
              include: { attribute: true, attributeValue: true },
            },
            images: { orderBy: { position: "asc" }, take: 1 },
            priceTiers: { where: { isActive: true }, orderBy: { minQuantity: "asc" } },
          },
          orderBy: { position: "asc" },
        },
        attributes: {
          include: { attribute: true, attributeValue: true },
          orderBy: { attribute: { name: "asc" } },
        },
      },
    });
    if (!product || product.deletedAt || (product.status !== "ACTIVE" && !this.isPubliclyVisible(product))) {
      throw NotFoundException("Product");
    }

    const related = await this.related(product.id, product.categoryId);

    const variantIds = product.variants.map((v) => v.id);
    const now = new Date();
    const promoItems = await this.prisma.promotionItem.findMany({
      where: {
        OR: [{ productVariantId: { in: variantIds } }, { productId: product.id }],
        promotion: { isActive: true, startAt: { lte: now }, endAt: { gte: now } },
      },
      include: { promotion: true },
    });
    const allScopePromos = await this.prisma.promotion.findMany({
      where: { scope: "ALL", isActive: true, startAt: { lte: now }, endAt: { gte: now } },
    });
    const promoMap = new Map<string, typeof promoItems>();
    for (const item of promoItems) {
      if (item.productVariantId) {
        const arr = promoMap.get(item.productVariantId) ?? [];
        arr.push(item);
        promoMap.set(item.productVariantId, arr);
      } else {
        for (const vid of variantIds) {
          const arr = promoMap.get(vid) ?? [];
          arr.push(item);
          promoMap.set(vid, arr);
        }
      }
    }
    for (const p of allScopePromos) {
      const fakeItem = { id: p.id, promotionId: p.id, productId: null, productVariantId: null, promotion: p } as typeof promoItems[number];
      for (const vid of variantIds) {
        const arr = promoMap.get(vid) ?? [];
        arr.push(fakeItem);
        promoMap.set(vid, arr);
      }
    }

    return {
      ...this.toSummary(product),
      brandId: product.brandId ?? undefined,
      categoryId: product.categoryId,
      categoryName: product.category.name,
      shortDescription: product.shortDescription ?? undefined,
      description: product.description ?? undefined,
      images: product.images.map((i) => ({
        id: i.id,
        url: i.url,
        alt: i.alt ?? undefined,
        position: i.position,
        isPrimary: i.isPrimary,
      })),
      videos: product.videos.map((v) => ({
        id: v.id,
        url: v.url,
        thumbnailUrl: v.thumbnailUrl ?? undefined,
      })),
      variants: product.variants.map((v) => {
        const priceTiers: PriceTierDto[] = (v.priceTiers ?? []).map((t) => ({
          id: t.id,
          productVariantId: t.productVariantId,
          minQuantity: t.minQuantity,
          price: t.price.toString(),
          isActive: t.isActive,
          createdAt: t.createdAt.toISOString(),
        }));
        const promotions: PromoMetaDto[] = (promoMap.get(v.id) ?? []).map((pi) => ({
          id: pi.promotion.id,
          name: pi.promotion.name,
          type: pi.promotion.type as PromotionTypeValue,
          scope: (pi.promotion.scope ?? "ALL") as PromotionScopeValue,
          value: Number((pi.promotion.config as { value?: number } | null)?.value ?? 0),
          minQuantity: Number((pi.promotion.config as { minQuantity?: number } | null)?.minQuantity ?? 1),
          endsAt: pi.promotion.endAt.toISOString(),
        }));
        return {
          id: v.id,
          sku: v.sku,
          name: v.name,
          price: v.price.toString(),
          mrp: v.mrp.toString(),
          position: v.position,
          isActive: v.isActive,
          options: v.variantAttributeValues.map((va) => ({
            attributeCode: va.attribute.code,
            attributeName: va.attribute.name,
            value: va.attributeValue?.value ?? va.rawValue ?? "",
          })),
          imageUrl: v.images[0]?.url,
          priceTiers,
          promotions,
        };
      }),
      attributes: product.attributes.map((pa) => ({
        attributeId: pa.attributeId,
        code: pa.attribute.code,
        name: pa.attribute.name,
        value: pa.attributeValue?.value ?? pa.valueText ?? (pa.valueNumber ? pa.valueNumber.toString() : ""),
      })),
      related,
    };
  }

  private isPubliclyVisible(product: Product): boolean {
    return product.status === "ACTIVE" && !product.deletedAt;
  }

  private toSummary(p: Product & { brand?: { name: string; slug: string } | null; images?: { url: string }[] }): ProductSummary {
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      brand: p.brand?.name,
      categorySlug: undefined,
      primaryImageUrl: p.images?.[0]?.url,
      mrp: p.mrp.toString(),
      sellingPrice: p.sellingPrice.toString(),
      ratingsAvg: p.ratingsAvg.toString(),
      ratingsCount: p.ratingsCount,
      salesCount: p.salesCount,
      isFeatured: p.isFeatured,
      status: p.status,
      publishedAt: p.publishedAt?.toISOString(),
    };
  }

  private async related(productId: string, categoryId: string): Promise<ProductSummary[]> {
    const rows = await this.prisma.productRelation.findMany({
      where: { OR: [{ productId }, { relatedProductId: productId }] },
      select: { productId: true, relatedProductId: true },
    });
    const ids = new Set<string>();
    for (const row of rows) {
      if (row.productId !== productId) ids.add(row.productId);
      if (row.relatedProductId !== productId) ids.add(row.relatedProductId);
    }
    if (ids.size === 0) {
      const fallback = await this.prisma.product.findMany({
        where: { id: { not: productId }, categoryId, status: "ACTIVE", deletedAt: null },
        take: 4,
        orderBy: [{ isFeatured: "desc" }, { salesCount: "desc" }],
        include: { images: { where: { isPrimary: true }, take: 1 } },
      });
      return fallback.map((p) => this.toSummary(p));
    }
    const products = await this.prisma.product.findMany({
      where: { id: { in: [...ids] }, status: "ACTIVE", deletedAt: null },
      include: { brand: true, images: { where: { isPrimary: true }, take: 1 } },
    });
    return products.map((p) => this.toSummary(p));
  }

  private async buildWhere(query: ProductListQueryInput, publicOnly: boolean): Promise<Prisma.ProductWhereInput> {
    const where: Prisma.ProductWhereInput = {};
    if (publicOnly) {
      where.status = "ACTIVE";
      where.deletedAt = null;
    } else {
      where.deletedAt = null;
    }

    if (query.category) {
      where.category = { is: { slug: query.category } };
    }
    if (query.brand) {
      where.brand = { is: { slug: query.brand } };
    }
    if (query.priceMin !== undefined && query.priceMin !== null) {
      where.sellingPrice = { gte: query.priceMin, ...(where.sellingPrice as object) };
    }
    if (query.priceMax !== undefined && query.priceMax !== null) {
      where.sellingPrice = { lte: query.priceMax, ...(where.sellingPrice as object) };
    }
    if (query.attrs) {
      const pairs = this.parseAttrFilters(query.attrs);
      for (const [code, valueSlug] of pairs) {
        where.AND = [
          ...(Array.isArray(where.AND) ? where.AND : []),
          { attributes: { some: { attribute: { code }, attributeValue: { slug: valueSlug } } } },
        ];
      }
    }
    return where;
  }

  private async buildFacetWhere(query: ProductListQueryInput): Promise<Prisma.ProductWhereInput> {
    const where: Prisma.ProductWhereInput = { status: "ACTIVE", deletedAt: null };
    if (query.category) where.category = { is: { slug: query.category } };
    if (query.brand) where.brand = { is: { slug: query.brand } };
    return where;
  }

  private async searchRanked(q: string, offset: number, limit: number): Promise<{ ids: string[]; total: number }> {
    const query = q.trim();
    const norm = query.toLowerCase();
    const len = query.length;
    const hasTrgm = len >= 3;

    const fuzzy = hasTrgm
      ? Prisma.sql`OR p."name" % ${query}
        OR b."name" % ${query}
        OR word_similarity(${query}, p."name") > 0.45
        OR word_similarity(${query}, coalesce(b."name", '')) > 0.45`
      : Prisma.empty;

    try {
      const rows = await this.prisma.$queryRaw<{ id: string; total: number }[]>(Prisma.sql`
        WITH matched AS (
          SELECT p."id",
            ( ts_rank_cd(p."search_vector", plainto_tsquery('english', ${query}), 32)::double precision * 2.0
              + GREATEST(
                  similarity(p."name", ${query}),
                  coalesce(similarity(b."name", ${query}), 0),
                  word_similarity(${query}, p."name"),
                  word_similarity(${query}, coalesce(b."name", ''))
                )::double precision * 10.0
              + CASE WHEN lower(left(p."name", ${len}::int)) = ${norm} THEN 20.0::double precision ELSE 0.0 END
              + CASE
                  WHEN b."name" IS NOT NULL AND lower(left(b."name", ${len}::int)) = ${norm}
                  THEN 12.0::double precision ELSE 0.0 END
              + p."sales_count"::double precision / 1000000.0
            ) AS score
          FROM "products" p
          LEFT JOIN "brands" b ON b."id" = p."brand_id"
          WHERE p."status" = 'ACTIVE' AND p."deleted_at" IS NULL
            AND (
              p."search_vector" @@ plainto_tsquery('english', ${query})
              OR lower(p."name") LIKE '%' || ${norm} || '%'
              OR lower(coalesce(b."name", '')) LIKE '%' || ${norm} || '%'
              ${fuzzy}
            )
        )
        SELECT m."id", (SELECT count(*)::int FROM matched) AS total
        FROM matched m
        ORDER BY m."score" DESC
        OFFSET ${offset}
        LIMIT ${limit}
      `);
      return { ids: rows.map((r) => r.id), total: Number(rows[0]?.total ?? 0) };
    } catch {
      return { ids: [], total: 0 };
    }
  }

  private parseAttrFilters(attrs: string): [string, string][] {
    const pairs: [string, string][] = [];
    for (const part of attrs.split(",")) {
      const [code, ...rest] = part.split(":");
      if (code && rest.length) pairs.push([code, rest.join(":")]);
    }
    return pairs;
  }

  private orderBy(sort?: ProductSort): Prisma.ProductOrderByWithRelationInput[] {
    switch (sort) {
      case "newest":
        return [{ createdAt: "desc" }];
      case "price-asc":
        return [{ sellingPrice: "asc" }];
      case "price-desc":
        return [{ sellingPrice: "desc" }];
      case "rating":
        return [{ ratingsAvg: "desc" }, { ratingsCount: "desc" }];
      case "popular":
        return [{ salesCount: "desc" }];
      default:
        return [{ isFeatured: "desc" }, { salesCount: "desc" }];
    }
  }

  private async facets(where: Prisma.ProductWhereInput): Promise<Facets> {
    const [brandGroups, attrGroups, priceAgg] = await Promise.all([
      this.prisma.product
        .groupBy({
          by: ["brandId"],
          where,
          _count: { _all: true },
        })
        .then((rows) =>
          (rows as unknown as { brandId: string | null; _count: { _all: number } }[]).sort(
            (a, b) => b._count._all - a._count._all,
          ),
        ),
      this.prisma.productAttribute.groupBy({
        by: ["attributeValueId"],
        where: { product: where, attribute: { isFilterable: true } },
        _count: { _all: true },
      }) as unknown as Promise<
        { attributeValueId: string | null; _count: { _all: number } }[]
      >,
      this.prisma.product.aggregate({
        where,
        _min: { sellingPrice: true },
        _max: { sellingPrice: true },
      }),
    ]);

    const brandIds = brandGroups
      .map((g) => g.brandId)
      .filter((id): id is string => id !== null);
    const brands = brandIds.length
      ? await this.prisma.brand.findMany({
          where: { id: { in: brandIds } },
          select: { id: true, name: true, slug: true },
        })
      : [];
    const brandMap = new Map(brands.map((b) => [b.id, b]));
    const brandFacets = brandGroups
      .filter((g) => g.brandId && brandMap.has(g.brandId))
      .map((g) => ({
        slug: brandMap.get(g.brandId!)!.slug,
        name: brandMap.get(g.brandId!)!.name,
        count: g._count._all,
      }));

    const valueIds = attrGroups.map((g) => g.attributeValueId).filter((id): id is string => id !== null);
    const valueRows = valueIds.length
      ? await this.prisma.attributeValue.findMany({
          where: { id: { in: valueIds } },
          include: { attribute: true },
        })
      : [];
    const valueMap = new Map(valueRows.map((v) => [v.id, v]));
    const attrMap = new Map<string, { id: string; code: string; name: string; values: { slug: string; value: string; count: number }[] }>();
    for (const g of attrGroups) {
      const value = valueMap.get(g.attributeValueId ?? "");
      if (!value) continue;
      const list = attrMap.get(value.attributeId) ?? {
        id: value.attributeId,
        code: value.attribute.code,
        name: value.attribute.name,
        values: [],
      };
      list.values.push({ slug: value.slug, value: value.value, count: g._count._all });
      attrMap.set(value.attributeId, list);
    }
    const attributes = [...attrMap.values()];

    return {
      brands: brandFacets,
      attributes,
      price: {
        min: (priceAgg._min.sellingPrice ?? new Prisma.Decimal(0)).toString(),
        max: (priceAgg._max.sellingPrice ?? new Prisma.Decimal(0)).toString(),
      },
    };
  }

  async adminList(query: ProductListQueryInput & { status?: ProductStatus }): Promise<ProductListResult> {
    const page = Math.max(1, query.page || 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize || 20));
    const where = await this.buildWhere({ ...query, q: undefined }, false);
    if (query.status) where.status = query.status;
    const [total, items] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        include: { brand: true, images: { where: { isPrimary: true }, take: 1 } },
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    const meta: PaginationMeta = { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
    return { data: items.map((p) => this.toSummary(p)), meta, facets: { brands: [], attributes: [], price: { min: "0", max: "0" } } };
  }

  async create(input: ProductCreateInput): Promise<ProductSummary> {
    if (!input.categoryId) throw ValidationException({ categoryId: "Category is required" });
    const category = await this.prisma.category.findUnique({ where: { id: input.categoryId } });
    if (!category || category.deletedAt) throw NotFoundException("Category");

    const slug = await this.uniqueSlug(input.name, input.slug);
    const publishedAt = input.status === "ACTIVE" ? new Date() : null;

    try {
      const product = await this.prisma.product.create({
        data: {
          sku: input.sku,
          name: input.name,
          slug,
          shortDescription: input.shortDescription ?? null,
          description: input.description ?? null,
          brandId: input.brandId ?? null,
          categoryId: input.categoryId,
          status: input.status ?? "DRAFT",
          mrp: this.money(input.mrp),
          sellingPrice: this.money(input.sellingPrice),
          currency: input.currency ?? "INR",
          weightG: input.weightG ?? null,
          lengthMm: input.lengthMm ?? null,
          widthMm: input.widthMm ?? null,
          heightMm: input.heightMm ?? null,
          returnEligible: input.returnEligible ?? true,
          isFeatured: input.isFeatured ?? false,
          seoTitle: input.seoTitle ?? null,
          seoDescription: input.seoDescription ?? null,
          seoKeywords: input.seoKeywords ?? null,
          publishedAt,
          images: input.images?.length ? { create: this.imageData(input.images) } : undefined,
          attributes: input.attributes?.length ? { create: this.attributeData(input.attributes) } : undefined,
          variants: input.variants?.length
            ? {
                create: input.variants.map((v) => ({
                  sku: v.sku,
                  name: v.name,
                  price: this.money(v.price),
                  mrp: this.money(v.mrp),
                  position: v.position ?? 0,
                  isActive: v.isActive ?? true,
                  variantAttributeValues: v.attributes?.length
                    ? {
                        create: v.attributes.map((a) => ({
                          attributeId: a.attributeId,
                          attributeValueId: a.attributeValueId ?? null,
                          rawValue: a.rawValue ?? null,
                        })),
                      }
                    : undefined,
                })),
              }
            : undefined,
        },
        include: { brand: true, images: { where: { isPrimary: true }, take: 1 } },
      });
      if (input.variants?.some((v) => v.images?.length)) {
        await this.createVariantImages(product.id, input.variants);
      }
      void this.searchService.indexProduct(product.id);
      return this.toSummary(product);
    } catch (err: unknown) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw ConflictException("SKU or slug already exists");
      }
      throw err;
    }
  }

  private async createVariantImages(productId: string, variants: ProductVariantInput[]): Promise<void> {
    const created = await this.prisma.productVariant.findMany({ where: { productId } });
    const bySku = new Map(created.map((v) => [v.sku, v]));
    const rows: Prisma.ProductImageCreateManyInput[] = [];
    for (const variant of variants) {
      const target = variant.images?.length ? bySku.get(variant.sku) : undefined;
      if (!target) continue;
      for (const image of this.imageData(variant.images!)) {
        rows.push({ ...image, productId, variantId: target.id });
      }
    }
    if (rows.length) await this.prisma.productImage.createMany({ data: rows });
  }

  async update(id: string, input: ProductUpdateInput): Promise<ProductSummary> {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) throw NotFoundException("Product");

    const slug =
      input.slug && input.slug !== existing.slug ? await this.uniqueSlug(input.name ?? existing.name, input.slug, id) : undefined;
    const publishedAt =
      input.status && input.status === "ACTIVE" && !existing.publishedAt ? new Date() : undefined;

    try {
      const product = await this.prisma.product.update({
        where: { id },
        data: {
          ...(input.sku !== undefined ? { sku: input.sku } : {}),
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(slug ? { slug } : {}),
          ...(input.shortDescription !== undefined ? { shortDescription: input.shortDescription ?? null } : {}),
          ...(input.description !== undefined ? { description: input.description ?? null } : {}),
          ...(input.brandId !== undefined ? { brandId: input.brandId ?? null } : {}),
          ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.mrp !== undefined ? { mrp: this.money(input.mrp) } : {}),
          ...(input.sellingPrice !== undefined ? { sellingPrice: this.money(input.sellingPrice) } : {}),
          ...(input.currency !== undefined ? { currency: input.currency } : {}),
          ...(input.weightG !== undefined ? { weightG: input.weightG ?? null } : {}),
          ...(input.lengthMm !== undefined ? { lengthMm: input.lengthMm ?? null } : {}),
          ...(input.widthMm !== undefined ? { widthMm: input.widthMm ?? null } : {}),
          ...(input.heightMm !== undefined ? { heightMm: input.heightMm ?? null } : {}),
          ...(input.returnEligible !== undefined ? { returnEligible: input.returnEligible } : {}),
          ...(input.isFeatured !== undefined ? { isFeatured: input.isFeatured } : {}),
          ...(input.seoTitle !== undefined ? { seoTitle: input.seoTitle ?? null } : {}),
          ...(input.seoDescription !== undefined ? { seoDescription: input.seoDescription ?? null } : {}),
          ...(input.seoKeywords !== undefined ? { seoKeywords: input.seoKeywords ?? null } : {}),
          ...(publishedAt ? { publishedAt } : {}),
          ...(input.images !== undefined
            ? { images: { deleteMany: {}, create: this.imageData(input.images) } }
            : {}),
          ...(input.attributes !== undefined
            ? { attributes: { deleteMany: {}, create: this.attributeData(input.attributes) } }
            : {}),
        },
        include: { brand: true, images: { where: { isPrimary: true }, take: 1 } },
      });
      void this.searchService.indexProduct(product.id);
      return this.toSummary(product);
    } catch (err: unknown) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw ConflictException("SKU or slug already exists");
      }
      throw err;
    }
  }

  private imageData(images: ProductImageInput[]) {
    return images.map((img, idx) => ({
      url: img.url,
      alt: img.alt ?? null,
      position: img.position ?? idx,
      isPrimary: img.isPrimary ?? idx === 0,
    }));
  }

  private attributeData(attributes: ProductAttributeInput[]) {
    return attributes.map((a) => ({
      attributeId: a.attributeId,
      attributeValueId: a.attributeValueId ?? null,
      valueText: a.valueText ?? null,
      valueNumber: a.valueNumber !== undefined ? new Prisma.Decimal(a.valueNumber) : null,
    }));
  }

  async remove(id: string): Promise<void> {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) throw NotFoundException("Product");
    await this.prisma.product.update({
      where: { id },
      data: { deletedAt: new Date(), isFeatured: false },
    });
    void this.searchService.removeProduct(id);
  }
}