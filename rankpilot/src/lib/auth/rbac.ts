export type Role = "owner" | "admin" | "editor" | "analyst" | "client";

export const ROLE_RANK: Record<Role, number> = {
  client: 0,
  analyst: 1,
  editor: 2,
  admin: 3,
  owner: 4,
};

export type Permission =
  | "website:read"
  | "website:write"
  | "website:delete"
  | "crawl:run"
  | "issues:read"
  | "issues:write"
  | "actions:read"
  | "actions:write"
  | "content:read"
  | "content:write"
  | "social:read"
  | "social:write"
  | "reports:read"
  | "reports:run"
  | "members:read"
  | "members:write"
  | "billing:read"
  | "billing:write"
  | "settings:read"
  | "settings:write"
  | "admin:read";

const ALL: Permission[] = [
  "website:read",
  "website:write",
  "website:delete",
  "crawl:run",
  "issues:read",
  "issues:write",
  "actions:read",
  "actions:write",
  "content:read",
  "content:write",
  "social:read",
  "social:write",
  "reports:read",
  "reports:run",
  "members:read",
  "members:write",
  "billing:read",
  "billing:write",
  "settings:read",
  "settings:write",
  "admin:read",
];

const READ_ONLY: Permission[] = [
  "website:read",
  "issues:read",
  "actions:read",
  "content:read",
  "social:read",
  "reports:read",
  "settings:read",
];

const PERMISSIONS: Record<Role, Permission[]> = {
  client: READ_ONLY,
  analyst: READ_ONLY,
  editor: [
    "website:read",
    "website:write",
    "crawl:run",
    "issues:read",
    "issues:write",
    "actions:read",
    "actions:write",
    "content:read",
    "content:write",
    "social:read",
    "social:write",
    "reports:read",
  ],
  // `billing:write` and `admin:read` are owner-only: billing changes money and
  // admin reads expose other tenants' failures, so neither belongs to admin.
  admin: ALL.filter((p) => p !== "billing:write" && p !== "admin:read"),
  owner: ALL,
};

export function can(role: string, perm: Permission): boolean {
  return (PERMISSIONS[role as Role] ?? []).includes(perm);
}
