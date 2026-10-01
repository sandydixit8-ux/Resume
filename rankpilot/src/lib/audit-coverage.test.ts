import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guardrail for the audit trail.
 *
 * `audit()` swallows write errors on purpose, so nothing at runtime tells you a
 * mutation stopped being logged. These tests read the route files instead.
 *
 * Note: every path here is handled with `fs` APIs / `path.join`, never with
 * PowerShell `Select-String -Path`, which treats `[id]` as a wildcard character
 * class and silently matches nothing for dynamic routes.
 */

const API_DIR = join(process.cwd(), "src", "app", "api");

function routeFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...routeFiles(full));
    else if (entry === "route.ts") out.push(full);
  }
  return out;
}

interface RouteInfo {
  rel: string;
  methods: string[];
  hasAudit: boolean;
  auditCalls: number;
  writes: boolean;
}

function inspect(file: string): RouteInfo {
  const src = readFileSync(file, "utf8");
  const rel = file.slice(API_DIR.length + 1).replace(/\\/g, "/").replace(/\/route\.ts$/, "");
  const methods = [...src.matchAll(/export async function (GET|POST|PATCH|PUT|DELETE)/g)].map(
    (m) => m[1] as string
  );
  return {
    rel,
    methods,
    hasAudit: /\baudit\(\{/.test(src),
    auditCalls: [...src.matchAll(/\baudit\(\{/g)].length,
    // A route that only reads has nothing to audit.
    writes: /\b(INSERT INTO|UPDATE |DELETE FROM)\b/.test(src),
  };
}

const routes = routeFiles(API_DIR).map(inspect);
const mutating = routes.filter((r) => r.methods.some((m) => m !== "GET"));

/**
 * A route may skip its own audit row when either:
 *  - it does not write (pure read-through / computation), or
 *  - it is an AI generation already recorded per-call in `ai_usage`
 *    (task, model, prompt version, tokens, cost, duration, status).
 * Everything else that mutates must leave an audit trail.
 */
const AI_METERED = /^(copilot|social\/ideas|social\/scripts)$/;

function exempt(r: RouteInfo): boolean {
  return !r.writes || AI_METERED.test(r.rel);
}


describe("audit coverage", () => {
  it("finds every route file, including dynamic segments", () => {
    // Guards the discovery logic itself: if this drops, coverage claims are void.
    const rels = routes.map((r) => r.rel);
    expect(rels).toContain("websites/[id]");
    expect(rels).toContain("actions/[id]");
    expect(rels).toContain("content/[contentId]");
    expect(rels).toContain("questions/[id]/answer");
    expect(rels.length).toBeGreaterThan(30);
  });

  it("audits every route that mutates and writes", () => {
    const missing = mutating
      .filter((r) => !exempt(r) && !r.hasAudit)
      .map((r) => `${r.rel} [${r.methods.join(",")}]`);
    expect(missing).toEqual([]);
  });

  it("gives every mutation its own audit call", () => {
    // A file-level "has at least one audit()" check is too weak: a route with
    // POST + DELETE that only logs the POST still passes it. Require at least
    // one audit call per mutating method, which is how crawl.cancel,
    // content.optimize and agency.website_assign were caught.
    const thin = mutating
      .filter((r) => !exempt(r))
      .filter((r) => r.auditCalls < r.methods.filter((m) => m !== "GET").length)
      .map((r) => `${r.rel} [${r.methods.join(",")}] audits=${r.auditCalls}`);
    expect(thin).toEqual([]);
  });

  it("audits security-sensitive routes explicitly", () => {    const mustAudit = [
      "auth/register/route.ts",
      "auth/login/route.ts",
      "auth/logout/route.ts",
      "auth/me/route.ts",
      "websites/route.ts",
      "websites/[id]/route.ts",
      "websites/[id]/verify/route.ts",
      "websites/[id]/crawl/route.ts",
      "members/route.ts",
      "billing/route.ts",
      "revenue/route.ts",
      "content/route.ts",
      "content/[contentId]/route.ts",
      "content/repurpose/route.ts",
      "issues/[id]/route.ts",
      "actions/[id]/route.ts",
      "experiments/route.ts",
      "cms-fixes/route.ts",
      "competitors/route.ts",
      "analytics/import/route.ts",
      "integrations/route.ts",
    ];
    const notAudited = mustAudit.filter((rel) => {
      const r = routes.find((x) => `${x.rel}/route.ts` === rel);
      return !r?.hasAudit;
    });
    expect(notAudited).toEqual([]);
  });

  it("keeps unaudited routes to read-through and AI-metered endpoints only", () => {
    const unexplained = mutating.filter((r) => !r.hasAudit && !exempt(r)).map((r) => r.rel);
    expect(unexplained).toEqual([]);
  });

  it("leaves exactly the intended endpoints unaudited", () => {
    // Precise invariant: these six are the only mutating routes with no
    // audit_logs row, and each is exempt for a stated reason.
    const unaudited = mutating.filter((r) => !r.hasAudit).map((r) => r.rel).sort();
    expect(unaudited).toEqual([
      "audit/free", // records to its own free_audits table, not audit_logs
      "copilot", // AI generation, metered in ai_usage
      "geo", // pure computation
      "keywords/enrich", // read-through: no provider key
      "social/ideas", // AI generation, metered in ai_usage
      "social/scripts", // AI generation, metered in ai_usage
    ]);
  });
});
