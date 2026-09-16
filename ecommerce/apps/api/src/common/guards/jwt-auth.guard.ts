import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { UserStatus } from "@prisma/client";
import { CurrentUser } from "@nexus/contracts";
import { PrismaService } from "../../prisma/prisma.service";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { UnauthorizedException as AppUnauthorized } from "../exceptions/app.exception";

export type AccessTokenPayload = { sub: string; sessionId: string };

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<{ headers: Record<string, string> }>();
    const header = request.headers["authorization"];
    if (!header || !header.startsWith("Bearer ")) {
      throw AppUnauthorized("Missing access token");
    }

    const token = header.slice(7).trim();
    let payload: AccessTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token, {
        secret: process.env.JWT_ACCESS_SECRET,
      });
    } catch {
      throw AppUnauthorized("Invalid or expired access token");
    }

    const user = await this.loadUser(payload.sub);
    this.attachUser(context, user);
    return true;
  }

  private async loadUser(sub: string): Promise<CurrentUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: sub },
      include: {
        userRoles: {
          include: {
            role: {
              include: { rolePermissions: { include: { permission: true } } },
            },
          },
        },
      },
    });
    if (!user || user.status !== UserStatus.ACTIVE || user.deletedAt) {
      throw AppUnauthorized("Account is not active");
    }
    const roles = user.userRoles.map((ur) => ur.role.code);
    const permissions = new Set<string>();
    for (const ur of user.userRoles) {
      for (const rp of ur.role.rolePermissions) {
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

  private attachUser(context: ExecutionContext, user: CurrentUser) {
    const request = context.switchToHttp().getRequest<{ user?: CurrentUser }>();
    request.user = user;
  }
}