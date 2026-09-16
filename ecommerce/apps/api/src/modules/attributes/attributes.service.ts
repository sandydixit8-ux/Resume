import { Injectable } from "@nestjs/common";
import { Attribute, AttributeDataType, AttributeValue, Category } from "@prisma/client";
import { AttributeDto, AttributeValueDto } from "@nexus/contracts";
import { PrismaService } from "../../prisma/prisma.service";
import { slugify } from "../../common/utils/slugify";
import { ConflictException, NotFoundException, ValidationException } from "../../common/exceptions/app.exception";

export type AttributeCreateInput = {
  code: string;
  name: string;
  dataType: AttributeDataType;
  unit?: string;
  isVariantAxis?: boolean;
  isFilterable?: boolean;
  values?: { value: string; slug?: string; position?: number }[];
};

export type AttributeValueCreateInput = {
  value: string;
  slug?: string;
  position?: number;
};

@Injectable()
export class AttributesService {
  constructor(private readonly prisma: PrismaService) {}

  private toValueDto(v: AttributeValue): AttributeValueDto {
    return { id: v.id, value: v.value, slug: v.slug, position: v.position };
  }

  private toDto(a: Attribute & { attributeValues: AttributeValue[] }): AttributeDto {
    return {
      id: a.id,
      code: a.code,
      name: a.name,
      dataType: a.dataType,
      unit: a.unit ?? undefined,
      isVariantAxis: a.isVariantAxis,
      isFilterable: a.isFilterable,
      values: [...a.attributeValues].sort((x, y) => x.position - y.position).map((v) => this.toValueDto(v)),
    };
  }

  async uniqueCode(name: string, preferred?: string, excludeId?: string): Promise<string> {
    const base = slugify(preferred?.trim() || name);
    let code = base;
    let i = 2;
    while (await this.prisma.attribute.findFirst({ where: { code, id: { not: excludeId } } })) {
      code = `${base}_${i++}`;
    }
    return code;
  }

  async list(categoryId?: string, categorySlug?: string): Promise<AttributeDto[]> {
    let attributes: (Attribute & { attributeValues: AttributeValue[] })[];
    if (categoryId || categorySlug) {
      const category = await this.resolveCategory(categoryId, categorySlug);
      const ancestors = await this.ancestorChain(category);
      const bindings = await this.prisma.categoryAttribute.findMany({
        where: { categoryId: { in: ancestors.map((a) => a.id) } },
        include: { attribute: { include: { attributeValues: true } } },
        orderBy: { position: "asc" },
      });
      attributes = bindings.map((b) => b.attribute);
    } else {
      attributes = await this.prisma.attribute.findMany({
        include: { attributeValues: true },
        orderBy: { name: "asc" },
      });
    }
    return attributes.map((a) => this.toDto(a));
  }

  private async resolveCategory(categoryId?: string, categorySlug?: string): Promise<Category> {
    const category = categoryId
      ? await this.prisma.category.findUnique({ where: { id: categoryId } })
      : categorySlug
        ? await this.prisma.category.findUnique({ where: { slug: categorySlug } })
        : null;
    if (!category || category.deletedAt) throw NotFoundException("Category");
    return category;
  }

  private async ancestorChain(category: Category): Promise<Category[]> {
    const chain: Category[] = [category];
    const slugs = category.path.split("/").filter(Boolean);
    if (slugs.length > 0) {
      const ancestors = await this.prisma.category.findMany({
        where: { slug: { in: slugs }, deletedAt: null, isActive: true },
      });
      chain.push(...ancestors.filter((a) => a.id !== category.id));
    }
    return chain;
  }

  async create(input: AttributeCreateInput): Promise<AttributeDto> {
    const seen = new Set<string>();
    const values = (input.values ?? []).map((v) => {
      const base = this.uniqueValueSlug(v.value, v.slug);
      let slug = base;
      let i = 2;
      while (seen.has(slug)) slug = `${base}_${i++}`;
      seen.add(slug);
      return { value: v.value, slug, position: v.position ?? 0 };
    });
    const attribute = await this.prisma.attribute.create({
      data: {
        code: await this.uniqueCode(input.name, input.code),
        name: input.name,
        dataType: input.dataType,
        unit: input.unit ?? null,
        isVariantAxis: input.isVariantAxis ?? false,
        isFilterable: input.isFilterable ?? false,
        attributeValues: { create: values },
      },
      include: { attributeValues: true },
    });
    return this.toDto(attribute);
  }

  private uniqueValueSlug(value: string, preferred?: string): string {
    return slugify(preferred?.trim() || value);
  }

  async update(id: string, input: Partial<Omit<AttributeCreateInput, "values">>): Promise<AttributeDto> {
    const existing = await this.prisma.attribute.findUnique({ where: { id } });
    if (!existing) throw NotFoundException("Attribute");
    const attribute = await this.prisma.attribute.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.code !== undefined && input.code !== existing.code
          ? { code: await this.uniqueCode(input.code, input.code, id) }
          : {}),
        ...(input.dataType !== undefined ? { dataType: input.dataType } : {}),
        ...(input.unit !== undefined ? { unit: input.unit ?? null } : {}),
        ...(input.isVariantAxis !== undefined ? { isVariantAxis: input.isVariantAxis } : {}),
        ...(input.isFilterable !== undefined ? { isFilterable: input.isFilterable } : {}),
      },
      include: { attributeValues: true },
    });
    return this.toDto(attribute);
  }

  async addValue(attributeId: string, input: AttributeValueCreateInput): Promise<AttributeValueDto> {
    const attribute = await this.prisma.attribute.findUnique({ where: { id: attributeId } });
    if (!attribute) throw NotFoundException("Attribute");
    const slug = this.uniqueValueSlug(input.value, input.slug);
    const clash = await this.prisma.attributeValue.findFirst({
      where: { attributeId, slug },
    });
    if (clash) throw ConflictException(`Value "${input.value}" already exists`);
    const value = await this.prisma.attributeValue.create({
      data: { attributeId, value: input.value, slug, position: input.position ?? 0 },
    });
    return this.toValueDto(value);
  }

  async removeValue(attributeId: string, valueId: string): Promise<void> {
    const value = await this.prisma.attributeValue.findFirst({
      where: { id: valueId, attributeId },
    });
    if (!value) throw NotFoundException("Attribute value");
    await this.prisma.attributeValue.delete({ where: { id: valueId } });
  }

  async remove(id: string): Promise<void> {
    const existing = await this.prisma.attribute.findUnique({ where: { id } });
    if (!existing) throw NotFoundException("Attribute");
    const referenced = await this.prisma.productAttribute.count({ where: { attributeId: id } });
    if (referenced > 0) throw ConflictException("Attribute is used by products");
    await this.prisma.attribute.delete({ where: { id } });
  }
}