import { Injectable } from "@nestjs/common";
import { Category, Prisma } from "@prisma/client";
import { CategoryDetail, CategoryDto, CategoryNode } from "@nexus/contracts";
import { PrismaService } from "../../prisma/prisma.service";
import { slugify } from "../../common/utils/slugify";
import { ConflictException, NotFoundException, ValidationException } from "../../common/exceptions/app.exception";

const CATEGORY_INCLUDE = {
  _count: { select: { children: true } },
} as const;

export type CategoryCreateInput = {
  name: string;
  slug?: string;
  parentId?: string;
  imageUrl?: string;
  description?: string;
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string;
  position?: number;
  isActive?: boolean;
};

export type CategoryUpdateInput = Partial<Omit<CategoryCreateInput, "parentId">> & {
  parentId?: string | null;
};

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async uniqueSlug(name: string, preferred?: string, excludeId?: string): Promise<string> {
    const base = slugify(preferred?.trim() || name);
    let slug = base;
    let i = 2;
    while (await this.prisma.category.findFirst({ where: { slug, id: { not: excludeId } } })) {
      slug = `${base}-${i++}`;
    }
    return slug;
  }

  async pathFor(parentId: string | null | undefined, slug: string) {
    if (!parentId) return { level: 1, path: `/${slug}` };
    const parent = await this.prisma.category.findUnique({ where: { id: parentId } });
    if (!parent) throw ValidationException({ parentId: "Parent category not found" });
    return { level: parent.level + 1, path: `${parent.path}/${slug}` };
  }

  toDto(category: Category, productCount = 0): CategoryDto {
    return {
      id: category.id,
      parentId: category.parentId ?? undefined,
      name: category.name,
      slug: category.slug,
      path: category.path,
      level: category.level,
      imageUrl: category.imageUrl ?? undefined,
      description: category.description ?? undefined,
      position: category.position,
      isActive: category.isActive,
      productCount,
    };
  }

  async tree(includeInactive = false): Promise<CategoryNode[]> {
    const categories = await this.prisma.category.findMany({
      where: { deletedAt: null, ...(includeInactive ? {} : { isActive: true }) },
      orderBy: [{ position: "asc" }, { name: "asc" }],
    });
    const counts = await this.productCounts();
    const nodes = new Map<string, CategoryNode>();
    for (const c of categories) {
      nodes.set(c.id, { ...this.toDto(c, counts.get(c.id) ?? 0), children: [] });
    }
    const roots: CategoryNode[] = [];
    for (const node of nodes.values()) {
      if (node.parentId && nodes.has(node.parentId)) {
        nodes.get(node.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }
    return roots;
  }

  async productCounts(): Promise<Map<string, number>> {
    const rows = await this.prisma.product.groupBy({
      by: ["categoryId"],
      where: { status: "ACTIVE", deletedAt: null },
      _count: { _all: true },
    });
    return new Map(rows.map((r) => [r.categoryId, r._count._all]));
  }

  async findBySlug(slug: string): Promise<CategoryDetail> {
    const category = await this.prisma.category.findUnique({ where: { slug } });
    if (!category || category.deletedAt || !category.isActive) {
      throw NotFoundException("Category");
    }
    const all = await this.tree(false);
    const counts = await this.productCounts();
    let children: CategoryNode[] = [];
    if (category.parentId) {
      children = this.findBranch(all, category.id)?.children ?? [];
    } else {
      children = all.find((n) => n.id === category.id)?.children ?? [];
    }
    const ancestors = category.path.split("/").filter(Boolean);
    return {
      ...this.toDto(category, counts.get(category.id) ?? 0),
      children,
      breadcrumbs: ancestors.map((a) => ({ name: a, slug: a })),
    };
  }

  private findBranch(nodes: CategoryNode[], id: string): CategoryNode | undefined {
    for (const node of nodes) {
      if (node.id === id) return node;
      const found = this.findBranch(node.children, id);
      if (found) return found;
    }
    return undefined;
  }

  async create(input: CategoryCreateInput): Promise<CategoryDto> {
    const slug = await this.uniqueSlug(input.name, input.slug);
    const { level, path } = await this.pathFor(input.parentId, slug);
    const category = await this.prisma.category.create({
      data: {
        name: input.name,
        slug,
        parentId: input.parentId ?? null,
        path,
        level,
        imageUrl: input.imageUrl ?? null,
        description: input.description ?? null,
        seoTitle: input.seoTitle ?? null,
        seoDescription: input.seoDescription ?? null,
        seoKeywords: input.seoKeywords ?? null,
        position: input.position ?? 0,
        isActive: input.isActive ?? true,
      },
    });
    return this.toDto(category);
  }

  async update(id: string, input: Partial<Omit<CategoryCreateInput, "slug" | "parentId">> & { slug?: string }): Promise<CategoryDto> {
    const existing = await this.prisma.category.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) throw NotFoundException("Category");

    let slug = existing.slug;
    if (input.slug && input.slug !== existing.slug) {
      slug = await this.uniqueSlug(input.name ?? existing.name, input.slug, id);
    }

    const category = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.category.update({
        where: { id },
        data: {
          name: input.name ?? existing.name,
          ...(slug !== existing.slug ? { slug } : {}),
          ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl ?? null } : {}),
          ...(input.description !== undefined ? { description: input.description ?? null } : {}),
          ...(input.seoTitle !== undefined ? { seoTitle: input.seoTitle ?? null } : {}),
          ...(input.seoDescription !== undefined ? { seoDescription: input.seoDescription ?? null } : {}),
          ...(input.seoKeywords !== undefined ? { seoKeywords: input.seoKeywords ?? null } : {}),
          ...(input.position !== undefined ? { position: input.position } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        },
      });
      const { level, path } = await this.pathFor(existing.parentId, slug);
      if (path !== existing.path || level !== existing.level) {
        await tx.category.update({ where: { id }, data: { path, level } });
        await this.rebuildSubtree(tx, id);
      }
      return updated;
    });

    return this.toDto(category);
  }

  async move(id: string, parentId: string | null): Promise<CategoryDto> {
    const existing = await this.prisma.category.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) throw NotFoundException("Category");
    if (parentId && parentId === id) throw ValidationException({ parentId: "A category cannot be its own parent" });
    const target = await this.prisma.category.findUnique({ where: { id: parentId ?? "" } });
    if (parentId && (!target || target.deletedAt)) throw NotFoundException("Category");

    const category = await this.prisma.$transaction(async (tx) => {
      const { level, path } = await this.pathFor(parentId, existing.slug);
      await tx.category.update({ where: { id }, data: { parentId, path, level } });
      await this.rebuildSubtree(tx, id);
      return tx.category.findUniqueOrThrow({ where: { id } });
    });
    return this.toDto(category);
  }

  private async rebuildSubtree(tx: Prisma.TransactionClient, categoryId: string): Promise<void> {
    const children = await tx.category.findMany({ where: { parentId: categoryId } });
    for (const child of children) {
      const rebuilt = await tx.category.findUniqueOrThrow({ where: { id: categoryId } });
      const path = `${rebuilt.path}/${child.slug}`;
      await tx.category.update({ where: { id: child.id }, data: { path, level: rebuilt.level + 1 } });
      await this.rebuildSubtree(tx, child.id);
    }
  }

  async remove(id: string): Promise<void> {
    const existing = await this.prisma.category.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) throw NotFoundException("Category");
    const childCount = await this.prisma.category.count({ where: { parentId: id, deletedAt: null } });
    if (childCount > 0) throw ConflictException("Category has children; move or delete them first");
    const productCount = await this.prisma.product.count({ where: { categoryId: id, deletedAt: null } });
    if (productCount > 0) throw ConflictException("Category has products; reassign them first");
    await this.prisma.category.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
  }

  async bindAttribute(categoryId: string, attributeId: string, position = 0): Promise<void> {
    const category = await this.prisma.category.findUnique({ where: { id: categoryId } });
    if (!category || category.deletedAt) throw NotFoundException("Category");
    const attribute = await this.prisma.attribute.findUnique({ where: { id: attributeId } });
    if (!attribute) throw NotFoundException("Attribute");
    await this.prisma.categoryAttribute.upsert({
      where: { categoryId_attributeId: { categoryId, attributeId } },
      create: { categoryId, attributeId, position },
      update: { position },
    });
  }

  async unbindAttribute(categoryId: string, attributeId: string): Promise<void> {
    const binding = await this.prisma.categoryAttribute.findUnique({
      where: { categoryId_attributeId: { categoryId, attributeId } },
    });
    if (!binding) throw NotFoundException("Attribute binding");
    await this.prisma.categoryAttribute.delete({ where: { id: binding.id } });
  }
}