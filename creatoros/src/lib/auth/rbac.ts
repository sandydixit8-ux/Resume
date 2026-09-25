export type Role = "owner" | "admin" | "editor" | "viewer";

export const ROLE_RANK: Record<Role, number> = {
  viewer: 0,
  editor: 1,
  admin: 2,
  owner: 3,
};

export type Permission =
  | "bio:read"
  | "bio:write"
  | "booking:read"
  | "booking:write"
  | "leads:read"
  | "leads:write"
  | "analytics:read"
  | "coach:read"
  | "billing:read"
  | "billing:write"
  | "settings:read"
  | "settings:write";

const PERMISSIONS: Record<Role, Permission[]> = {
  viewer: ["bio:read", "booking:read", "leads:read", "analytics:read"],
  editor: ["bio:read", "bio:write", "booking:read", "booking:write", "leads:read", "leads:write", "analytics:read"],
  admin: ["bio:read", "bio:write", "booking:read", "booking:write", "leads:read", "leads:write", "analytics:read", "coach:read", "settings:read", "settings:write"],
  owner: ["bio:read", "bio:write", "booking:read", "booking:write", "leads:read", "leads:write", "analytics:read", "coach:read", "billing:read", "billing:write", "settings:read", "settings:write"],
};

export function can(role: Role, perm: Permission): boolean {
  return PERMISSIONS[role]?.includes(perm) ?? false;
}