import { SetMetadata } from "@nestjs/common";

export const PERMISSIONS_KEY = "requiredPermissions";
export const ROLES_KEY = "requiredRoles";

export const RequirePermissions = (...permissions: string[]) => SetMetadata(PERMISSIONS_KEY, permissions);
export const RequireRoles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);