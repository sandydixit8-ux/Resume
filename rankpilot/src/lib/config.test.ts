import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  authSecretProblem,
  emailDeliveryProblem,
  isProductionRuntime,
  productionConfigWarnings,
  MIN_SECRET_LENGTH,
  PLACEHOLDER_SECRET,
} from "./config";

/**
 * Preflight configuration behaviour.
 *
 * Two rules matter here and they pull in opposite directions:
 *
 *   1. A missing auth secret must be FATAL. A server without it cannot sign a
 *      session, so every session-dependent request 500s while the process
 *      happily reports "Ready" and holds the port open.
 *   2. A missing mail provider must NOT be fatal. Anonymous audits and paid
 *      traffic do not need email, and refusing to boot would block releases
 *      over an integration that has not been chosen yet. But it must not be
 *      silent either, because the cost is users being permanently locked out
 *      of password reset with no indication of why.
 */

/**
 * Next.js declares `NODE_ENV` as a read-only property of `process.env`, so the
 * production-runtime cases have to write through a mutable view of it.
 */
function setNodeEnv(value: string): void {
  (process.env as Record<string, string | undefined>).NODE_ENV = value;
}

const saved = {
  nodeEnv: process.env.NODE_ENV,
  authSecret: process.env.AUTH_SECRET,
  webhook: process.env.EMAIL_WEBHOOK_URL,
  passphrase: process.env.BACKUP_PASSPHRASE,
  phase: process.env.NEXT_PHASE,
};

function asProduction(): void {
  setNodeEnv("production");
  delete process.env.NEXT_PHASE;
  // Satisfy the fatal check so these tests exercise the warnings, not AUTH_SECRET.
  process.env.AUTH_SECRET = "a".repeat(MIN_SECRET_LENGTH);
}

beforeEach(() => {
  setNodeEnv("test");
  delete process.env.EMAIL_WEBHOOK_URL;
  delete process.env.BACKUP_PASSPHRASE;
  delete process.env.NEXT_PHASE;
  delete process.env.AUTH_SECRET;
});

afterEach(() => {
  setNodeEnv(saved.nodeEnv ?? "test");
  if (saved.authSecret === undefined) delete process.env.AUTH_SECRET;
  else process.env.AUTH_SECRET = saved.authSecret;
  if (saved.webhook === undefined) delete process.env.EMAIL_WEBHOOK_URL;
  else process.env.EMAIL_WEBHOOK_URL = saved.webhook;
  if (saved.passphrase === undefined) delete process.env.BACKUP_PASSPHRASE;
  else process.env.BACKUP_PASSPHRASE = saved.passphrase;
  if (saved.phase === undefined) delete process.env.NEXT_PHASE;
  else process.env.NEXT_PHASE = saved.phase;
});

describe("authSecretProblem", () => {
  it("accepts a long random secret", () => {
    // Must contain no placeholder-ish substring, since the check is
    // deliberately broad and rejects on words like "example" anywhere.
    expect(authSecretProblem("a".repeat(MIN_SECRET_LENGTH))).toBeNull();
  });

  it("rejects a missing, short, blank or placeholder secret with a specific reason", () => {
    expect(authSecretProblem(undefined)).toMatch(/not set/);
    expect(authSecretProblem("   ")).toMatch(/not set/);
    expect(authSecretProblem("tooshort")).toMatch(/only 8 characters/);
    expect(authSecretProblem("change-me-to-a-long-random-string")).toMatch(/placeholder/);
  });

  it("catches placeholder shapes that are long enough to pass a length check", () => {
    // Every one of these is >= MIN_SECRET_LENGTH, so a length check alone would
    // wave them through. Length is verified first, so a short placeholder is
    // reported as short, not as a placeholder.
    for (const shape of [
      "change-me-to-a-long-random-string",
      "your-secret-here-please-abcdefghij",
      "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    ]) {
      expect(shape.length).toBeGreaterThanOrEqual(MIN_SECRET_LENGTH);
      expect(PLACEHOLDER_SECRET.test(shape)).toBe(true);
      expect(authSecretProblem(shape)).toMatch(/placeholder/);
    }
  });
});

describe("emailDeliveryProblem", () => {
  it("stays quiet outside production so dev and test are not nagged", () => {
    setNodeEnv("development");
    expect(emailDeliveryProblem()).toBeNull();
  });

  it("stays quiet during the build phase", () => {
    asProduction();
    process.env.NEXT_PHASE = "phase-production-build";
    expect(isProductionRuntime()).toBe(false);
    expect(emailDeliveryProblem()).toBeNull();
  });

  it("warns in production when no provider is configured", () => {
    asProduction();
    expect(emailDeliveryProblem()).toMatch(/EMAIL_WEBHOOK_URL is not set/);
  });

  it("accepts a valid https webhook", () => {
    asProduction();
    process.env.EMAIL_WEBHOOK_URL = "https://hooks.example.com/send";
    expect(emailDeliveryProblem()).toBeNull();
  });

  it("rejects a non-https webhook, which would carry credentials in clear text", () => {
    asProduction();
    process.env.EMAIL_WEBHOOK_URL = "http://hooks.example.com/send";
    expect(emailDeliveryProblem()).toMatch(/not https/);
  });

  it("rejects a malformed URL rather than failing later at send time", () => {
    asProduction();
    process.env.EMAIL_WEBHOOK_URL = "not a url";
    expect(emailDeliveryProblem()).toMatch(/not a valid URL/);
  });
});

describe("productionConfigWarnings", () => {
  it("returns nothing outside production", () => {
    setNodeEnv("development");
    expect(productionConfigWarnings()).toEqual([]);
  });

  it("warns about both email and plaintext backups when neither is configured", () => {
    asProduction();
    const warnings = productionConfigWarnings();
    expect(warnings.join("\n")).toMatch(/EMAIL_WEBHOOK_URL/);
    expect(warnings.join("\n")).toMatch(/BACKUP_PASSPHRASE/);
  });

  it("warns about plaintext backups even when email is fine", () => {
    asProduction();
    process.env.EMAIL_WEBHOOK_URL = "https://hooks.example.com/send";
    const warnings = productionConfigWarnings();
    expect(warnings.join("\n")).toMatch(/BACKUP_PASSPHRASE/);
    expect(warnings.join("\n")).not.toMatch(/EMAIL_WEBHOOK_URL/);
  });

  it("is silent when everything is configured", () => {
    asProduction();
    process.env.EMAIL_WEBHOOK_URL = "https://hooks.example.com/send";
    process.env.BACKUP_PASSPHRASE = "a-real-passphrase";
    process.env.NEXT_PUBLIC_SITE_URL = "https://rankpilot.example";
    expect(productionConfigWarnings()).toEqual([]);
  });

  it("warns when the site URL is unset, which unindexes the site and stops reset emails", () => {
    // Not cosmetic: with no site URL the canonical tags, sitemap.xml and
    // robots.txt all point at localhost, and password-reset emails cannot be
    // sent at all because the link origin would be unknown.
    asProduction();
    process.env.EMAIL_WEBHOOK_URL = "https://hooks.example.com/send";
    process.env.BACKUP_PASSPHRASE = "a-real-passphrase";
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.APP_URL;
    delete process.env.RANKPILOT_PUBLIC_URL;
    delete process.env.SITE_URL;
    expect(productionConfigWarnings().join("\n")).toMatch(/SITE_URL/);
  });

  it("warns when the site URL is still localhost in production", () => {
    asProduction();
    process.env.EMAIL_WEBHOOK_URL = "https://hooks.example.com/send";
    process.env.BACKUP_PASSPHRASE = "a-real-passphrase";
    process.env.SITE_URL = "http://localhost:3000";
    expect(productionConfigWarnings().join("\n")).toMatch(/localhost/);
  });
});
