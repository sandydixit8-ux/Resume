import type { PriceTierDto } from "./pricing";
import type { PromoMetaDto } from "./pricing";
import type { PaginationMeta } from "./errors";

export type ProductStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "ACTIVE"
  | "OUT_OF_STOCK"
  | "ARCHIVED"
  | "DISABLED";

export type AttributeDataType = "TEXT" | "NUMBER" | "BOOLEAN" | "SELECT" | "MULTISELECT" | "COLOR";

export type CategoryDto = {
  id: string;
  parentId?: string;
  name: string;
  slug: string;
  path: string;
  level: number;
  imageUrl?: string;
  description?: string;
  position: number;
  isActive: boolean;
  productCount: number;
};

export type CategoryNode = CategoryDto & {
  children: CategoryNode[];
};

export type CategoryDetail = CategoryDto & {
  children: CategoryNode[];
  breadcrumbs: { name: string; slug: string }[];
};

export type BrandDto = {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  description?: string;
  isActive: boolean;
};

export type AttributeValueDto = {
  id: string;
  value: string;
  slug: string;
  position: number;
};

export type AttributeDto = {
  id: string;
  code: string;
  name: string;
  dataType: AttributeDataType;
  unit?: string;
  isVariantAxis: boolean;
  isFilterable: boolean;
  values: AttributeValueDto[];
};

export type ProductImageDto = {
  id: string;
  url: string;
  alt?: string;
  position: number;
  isPrimary: boolean;
};

export type VariantOptionDto = {
  attributeCode: string;
  attributeName: string;
  value: string;
};

export type ProductVariantDto = {
  id: string;
  sku: string;
  name: string;
  price: string;
  mrp: string;
  position: number;
  isActive: boolean;
  options: VariantOptionDto[];
  imageUrl?: string;
  priceTiers: PriceTierDto[];
  promotions: PromoMetaDto[];
};

export type ProductSummary = {
  id: string;
  name: string;
  slug: string;
  brand?: string;
  categorySlug?: string;
  primaryImageUrl?: string;
  mrp: string;
  sellingPrice: string;
  ratingsAvg: string;
  ratingsCount: number;
  salesCount: number;
  isFeatured: boolean;
  status?: ProductStatus;
  publishedAt?: string;
};

export type ProductDetail = ProductSummary & {
  shortDescription?: string;
  description?: string;
  brandId?: string;
  categoryId: string;
  categoryName: string;
  images: ProductImageDto[];
  videos: { id: string; url: string; thumbnailUrl?: string }[];
  variants: ProductVariantDto[];
  attributes: { attributeId: string; code: string; name: string; value: string }[];
  related: ProductSummary[];
};

export type PriceFacet = {
  min: string;
  max: string;
};

export type BrandFacet = {
  slug: string;
  name: string;
  count: number;
};

export type AttributeFacet = {
  id: string;
  code: string;
  name: string;
  values: { slug: string; value: string; count: number }[];
};

export type Facets = {
  brands: BrandFacet[];
  attributes: AttributeFacet[];
  price: PriceFacet;
};

export type ProductListQuery = {
  q?: string;
  category?: string;
  brand?: string;
  attrs?: string;
  sort?: "relevance" | "newest" | "price-asc" | "price-desc" | "rating" | "popular";
  priceMin?: number;
  priceMax?: number;
  page?: number;
  pageSize?: number;
};

export type ProductListResult = {
  data: ProductSummary[];
  meta: PaginationMeta;
  facets: Facets;
};

export type CollectionDto = {
  id: string;
  name: string;
  slug: string;
  type: string;
  isActive: boolean;
  coverImageUrl?: string;
  productCount: number;
};

export type CollectionDetail = CollectionDto & {
  seoTitle?: string;
  seoDescription?: string;
};