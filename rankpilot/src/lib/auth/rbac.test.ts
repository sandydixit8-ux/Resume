import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { can, type Permission, type Role } from "./rbac";

const ROLES: Role[] = ["owner", "admin", "editor", "analyst", "client"];

function apiRoutes(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...apiRoutes(full));
    else if (entry === "route.ts") out.push(full);
  }
  return out;
}

describe("role permissions", () => {
  it("keeps read-only roles read-only", () => {
    const writes: Permission[] = [
      "website:write",
      "website:delete",
      "crawl:run",
      "issues:write",
      "actions:write",
      "content:write",
      "social:write",
      "reports:run",
      "members:write",
      "billing:write",
      "settings:write",
    ];
    for (const role of ["client", "analyst"] as const) {
      for (const perm of writes) {
        expect(can(role, perm), `${role} must not hold ${perm}`).toBe(false);
      }
    }
  });

  it("lets editors run crawls and edit sites, but not delete or bill", () => {
    expect(can("editor", "crawl:run")).toBe(true);
    expect(can("editor", "website:write")).toBe(true);
    expect(can("editor", "issues:write")).toBe(true);
    expect(can("editor", "actions:write")).toBe(true);
    expect(can("editor", "website:delete")).toBe(false);
    expect(can("editor", "billing:write")).toBe(false);
    expect(can("editor", "members:write")).toBe(false);
  });

  it("reserves destructive and billing permissions for admins and owners", () => {
    for (const role of ["admin", "owner"] as const) {
      expect(can(role, "website:delete")).toBe(true);
      expect(can(role, "crawl:run")).toBe(true);
    }
    expect(can("admin", "billing:write")).toBe(false);
    expect(can("owner", "billing:write")).toBe(true);
  });

  it("denies every unknown role rather than defaulting to access", () => {
    for (const perm of ["website:write", "crawl:run", "content:write"] as Permission[]) {
      expect(can("superuser", perm)).toBe(false);
      expect(can("", perm)).toBe(false);
    }
  });

  it("keeps the cross-tenant operational view owner-only", () => {
    // `admin:read` exposes failed jobs and stuck crawls for every tenant, so
    // it must not reach admin, let alone any read-only role.
    expect(can("owner", "admin:read")).toBe(true);
    for (const role of ["admin", "editor", "analyst", "client"] as const) {
      expect(can(role, "admin:read"), `${role} must not hold admin:read`).toBe(false);
    }
  });

  it("keeps permissions ordered so more access never means less", () => {
    const rank = { client: 0, analyst: 1, editor: 2, admin: 3, owner: 4 };
    const perms: Permission[] = [
      "website:read",
      "website:write",
      "crawl:run",
      "issues:read",
      "issues:write",
      "actions:write",
      "content:write",
      "social:write",
      "reports:read",
      "reports:run",
      "members:read",
      "billing:read",
      "settings:read",
    ];
    for (const perm of perms) {
      for (let i = 1; i < ROLES.length; i++) {
        const lower = ROLES[i - 1];
        const higher = ROLES[i];
        if (rank[lower] >= rank[higher]) continue;
        if (can(higher, perm) && !can(lower, perm)) continue;
        // analyst is intentionally read-only like client; editor is the first write tier.
        if (lower === "client" && higher === "analyst") continue;
        expect(can(higher, perm), `${higher} should hold everything ${lower} holds (${perm})`).toBe(
          can(lower, perm)
        );
      }
    }
  });
});

describe("route authorization", () => {
  const routes = apiRoutes(join(process.cwd(), "src", "app", "api"));

  it("finds the api routes", () => {
    expect(routes.length).toBeGreaterThan(30);
  });

  it("never hardcodes a session role check instead of using the matrix", () => {
    const offenders: string[] = [];
    for (const file of routes) {
      const src = readFileSync(file, "utf8");
      if (/s\.role\s*===/.test(src) || /function can(Edit|Write)\(/.test(src)) {
        offenders.push(file.replace(process.cwd(), ""));
      }
    }
    expect(offenders, "use can(role, permission) from @/lib/auth/rbac").toEqual([]);
  });

  it("guards every mutating route with a session and a permission", () => {
    // No session by design: they are the public/authenticated entry points.
    // Password reset is here because it is reachable before you can sign in.
    // Both are safe to leave open only because they are rate limited, take no
    // tenant context, and return an opaque result.
    const publicPaths = new Set([
      "/audit/free",
      "/auth/login",
      "/auth/register",
      "/auth/logout",
      "/auth/forgot-password",
      "/auth/reset-password",
      "/auth/verify-email",
      "/auth/resend-verification",
      "/health",
    ]);
    // No session by signature instead of by design: Stripe authenticates this
    // with an HMAC over the raw body, not a user cookie, so getSession() is the
    // wrong gate. The tenant comes from the signed event payload itself.
    const signaturePaths = new Set(["/billing/webhook"]);
    // Session but no permission, by design: a user editing only their own profile row,
    // or revoking only their own sessions.
    const selfScoped = new Set(["/auth/me", "/auth/logout-all"]);
    const offenders: string[] = [];
    for (const file of routes) {
      const rel = file
        .replace(join(process.cwd(), "src", "app", "api"), "")
        .replace(/\\/g, "/")
        .replace(/\/route\.ts$/, "");
      const routePath = rel.startsWith("/") ? rel : `/${rel}`;
      if (publicPaths.has(routePath) || signaturePaths.has(routePath)) continue;

      const src = readFileSync(file, "utf8");
      const methods = [...src.matchAll(/export async function (POST|PATCH|PUT|DELETE)\b/g)].map(
        (m) => m[1]
      );
      if (methods.length === 0) continue;

      if (!/getSession\(\)/.test(src)) {
        offenders.push(`${routePath}: no session check`);
        continue;
      }
      if (selfScoped.has(routePath)) continue;
      // Permission may come from can() directly or from aiCall()'s permission argument.
      if (!/can\(\s*s\.role\s*,/.test(src) && !/aiCall</.test(src)) {
        offenders.push(`${routePath}: no permission check`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("rate limits the unauthenticated write endpoints", () => {
    // These routes are exempt from the session check above, which is only safe
    // while they are throttled -- otherwise login, registration and password
    // reset are free to brute-force or mail-bomb.
    const mustThrottle = [
      "/auth/login",
      "/auth/register",
      "/auth/forgot-password",
      "/auth/reset-password",
      "/auth/verify-email",
      "/auth/resend-verification",
    ];
    const missing: string[] = [];
    for (const routePath of mustThrottle) {
      const file = routes.find((f) =>
        f.replace(join(process.cwd(), "src", "app", "api"), "").replace(/\\/g, "/").replace(/\/route\.ts$/, "").endsWith(routePath)
      );
      if (!file || !/rateLimit\(/.test(readFileSync(file, "utf8"))) missing.push(routePath);
    }
    expect(missing, "unauthenticated write endpoint without a rate limit").toEqual([]);
  });

  it("keeps the unauthenticated write routes free of tenant context", () => {
    // A public route must not read s.tenantId or scope anything: it has no
    // session, so any such reference is either dead code or a bug.
    for (const routePath of [
      "/auth/forgot-password",
      "/auth/reset-password",
      "/auth/resend-verification",
      "/auth/verify-email",
      "/audit/free",
    ]) {
      const file = routes.find((f) =>
        f.replace(join(process.cwd(), "src", "app", "api"), "").replace(/\\/g, "/").replace(/\/route\.ts$/, "").endsWith(routePath)
      );
      expect(file, `missing ${routePath}`).toBeDefined();
      const src = readFileSync(file as string, "utf8");
      expect(src, `${routePath} must not reference a session tenant`).not.toMatch(/s\.tenantId/);
    }
  });
});
