import { Injectable } from "@nestjs/common";
import { CurrentUser, PaginationMeta } from "@nexus/contracts";
import { Prisma, UserStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { ConflictException, NotFoundException } from "../../common/exceptions/app.exception";
import { PaginationDto } from "../../common/dto/pagination.dto";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getCurrentUser(userId: string): Promise<CurrentUser> {
    const r = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!r) throw NotFoundException("User");
    return this.toCurrentUser(r, await this.rolesWithPermissions(r.id));
  }

  async updateProfile(
    userId: string,
    data: { name?: string; phone?: string },
  ): Promise<CurrentUser> {
    if (data.phone) {
      const clash = await this.prisma.user.findUnique({ where: { phone: data.phone } });
      if (clash && clash.id !== userId) {
        throw ConflictException("Phone number already in use");
      }
    }
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { ...data, phone: data.phone ?? undefined, name: data.name ?? undefined },
    });
    return this.toCurrentUser(user, await this.rolesWithPermissions(user.id));
  }

  async listUsers(
    pagination: PaginationDto,
    filter?: { role?: string; status?: string; query?: string },
  ): Promise<{ data: CurrentUser[]; meta: PaginationMeta }> {
    const where: Prisma.UserWhereInput = { deletedAt: null };
    if (filter?.status) {
      where.status = filter.status as UserStatus;
    }
    if (filter?.query) {
      where.OR = [
        { email: { contains: filter.query, mode: "insensitive" } },
        { name: { contains: filter.query, mode: "insensitive" } },
      ];
    }
    if (filter?.role) {
      const role = await this.prisma.role.findUnique({ where: { code: filter.role } });
      if (role) {
        where.userRoles = { some: { roleId: role.id } };
      }
    }

    const [total, users] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
        select: {
          id: true,
          email: true,
          phone: true,
          name: true,
          status: true,
          emailVerifiedAt: true,
          phoneVerifiedAt: true,
          createdAt: true,
        },
      }),
    ]);

    const rolesMap = new Map<string, string[]>();
    const raws = await this.prisma.userRole.findMany({
      where: { userId: { in: users.map((u) => u.id) } },
      include: { role: true },
    });
    for (const raw of raws) {
      const list = rolesMap.get(raw.userId) ?? [];
      list.push(raw.role.code);
      rolesMap.set(raw.userId, list);
    }

    return {
      data: users.map((u) => ({
        id: u.id,
        email: u.email,
        phone: u.phone ?? undefined,
        name: u.name,
        emailVerified: Boolean(u.emailVerifiedAt),
        phoneVerified: Boolean(u.phoneVerifiedAt),
        roles: rolesMap.get(u.id) ?? [],
        permissions: [],
      })),
      meta: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        total,
        totalPages: Math.ceil(total / pagination.pageSize),
      },
    };
  }

  private async rolesWithPermissions(userId: string) {
    return this.prisma.userRole.findMany({
      where: { userId },
      include: {
        role: {
          include: { rolePermissions: { include: { permission: true } } },
        },
      },
    });
  }

  private toCurrentUser(
    user: {
      id: string;
      email: string;
      phone: string | null;
      name: string;
      emailVerifiedAt: Date | null;
      phoneVerifiedAt: Date | null;
    },
    rolesWithPermissions: Awaited<ReturnType<UsersService["rolesWithPermissions"]>>,
  ): CurrentUser {
    const permissions = new Set<string>();
    const roles: string[] = [];
    for (const r of rolesWithPermissions) {
      roles.push(r.role.code);
      for (const rp of r.role.rolePermissions) {
        permissions.add(rp.permission.code);
      }
    }
    return {
      id: user.id,
      email: user.email,
      phone: user.phone ?? undefined,
      name: user.name,
      emailVerified: Boolean(user.emailVerifiedAt),
      phoneVerified: Boolean(user.phoneVerifiedAt),
      roles,
      permissions: [...permissions],
    };
  }
}