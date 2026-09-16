import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { CurrentUser } from "@nexus/contracts";
import { ForbiddenException } from "../exceptions/app.exception";
import { PERMISSIONS_KEY, ROLES_KEY } from "../decorators/rbac.decorator";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions?.length && !requiredRoles?.length) {
      return true;
    }

    const user = context.switchToHttp().getRequest<{ user?: CurrentUser }>().user;
    if (!user) {
      throw ForbiddenException("Authentication required");
    }

    if (requiredRoles?.length && !requiredRoles.some((r) => user.roles.includes(r))) {
      throw ForbiddenException();
    }

    if (requiredPermissions?.length) {
      const missing = requiredPermissions.filter((p) => !user.permissions.includes(p));
      if (missing.length) {
        throw ForbiddenException(`Missing permission: ${missing.join(", ")}`);
      }
    }

    return true;
  }
}