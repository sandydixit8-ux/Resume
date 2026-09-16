import { Injectable } from "@nestjs/common";
import { Brand, Prisma } from "@prisma/client";
import { BrandDto } from "@nexus/contracts";
import { PrismaService } from "../../prisma/prisma.service";
import { slugify } from "../../common/utils/slugify";
import { NotFoundException } from "../../common/exceptions/app.exception";

export type BrandCreateInput = {
  name: string;
  slug?: string;
  logoUrl?: string;
  description?: string;
  seoTitle?: string;
  seoDescription?: string;
  isActive?: boolean;
};

@Injectable()
export class BrandsService {
  constructor(private readonly prisma: PrismaService) {}

  private toDto(brand: Brand): BrandDto {
    return {
      id: brand.id,
      name: brand.name,
      slug: brand.slug,
      logoUrl: brand.logoUrl ?? undefined,
      description: brand.description ?? undefined,
      isActive: brand.isActive,
    };
  }

  async uniqueSlug(name: string, preferred?: string, excludeId?: string): Promise<string> {
    const base = slugify(preferred?.trim() || name);
    let slug = base;
    let i = 2;
    while (await this.prisma.brand.findFirst({ where: { slug, id: { not: excludeId } } })) {
      slug = `${base}-${i++}`;
    }
    return slug;
  }

  async list(includeInactive = false): Promise<BrandDto[]> {
    const brands = await this.prisma.brand.findMany({
      where: { deletedAt: null, ...(includeInactive ? {} : { isActive: true }) },
      orderBy: { name: "asc" },
    });
    return brands.map((b) => this.toDto(b));
  }

  async create(input: BrandCreateInput): Promise<BrandDto> {
    const brand = await this.prisma.brand.create({
      data: {
        name: input.name,
        slug: await this.uniqueSlug(input.name, input.slug),
        logoUrl: input.logoUrl ?? null,
        description: input.description ?? null,
        seoTitle: input.seoTitle ?? null,
        seoDescription: input.seoDescription ?? null,
        isActive: input.isActive ?? true,
      },
    });
    return this.toDto(brand);
  }

  async update(id: string, input: Partial<BrandCreateInput>): Promise<BrandDto> {
    const existing = await this.prisma.brand.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) throw NotFoundException("Brand");
    const brand = await this.prisma.brand.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.slug !== undefined && input.slug !== existing.slug
          ? { slug: await this.uniqueSlug(input.slug, input.slug, id) }
          : {}),
        ...(input.logoUrl !== undefined ? { logoUrl: input.logoUrl ?? null } : {}),
        ...(input.description !== undefined ? { description: input.description ?? null } : {}),
        ...(input.seoTitle !== undefined ? { seoTitle: input.seoTitle ?? null } : {}),
        ...(input.seoDescription !== undefined ? { seoDescription: input.seoDescription ?? null } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });
    return this.toDto(brand);
  }

  async remove(id: string): Promise<void> {
    const existing = await this.prisma.brand.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) throw NotFoundException("Brand");
    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.brand.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
    });
  }
}