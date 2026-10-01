/**
 * Startup configuration checks. Kept separate from the modules that consume the
 * values so the failure names the *configuration* problem rather than surfacing
 * as a side effect of importing a feature module.
 */

import { siteUrlProblem } from "./site-url";

export const MIN_SECRET_LENGTH = 32;
/**
 * A length check alone is not enough: the placeholder in `.env.example` is 35
 * characters, so a short-but-realistic secret and a copied placeholder are
 * indistinguishable by size alone.
 */
export const PLACEHOLDER_SECRET = /change[-_ ]?me|placeholder|example|your[-_ ]?secret|replace[-_ ]?me|xxx+/i;

/** True when this process is a build, not a running server. */
function isBuildPhase(): boolean {
  return process.env.NEXT_PHASE === "phase-production-build";
}

export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production" && !isBuildPhase();
}

/** Returns a human-readable reason the secret is unacceptable, or null if it is fine. */
export function authSecretProblem(secret: string | undefined): string | null {
  const configured = (secret || "").trim();
  if (!configured) return "AUTH_SECRET is not set";
  if (configured.length < MIN_SECRET_LENGTH) {
    return `AUTH_SECRET is only ${configured.length} characters; at least ${MIN_SECRET_LENGTH} are required`;
  }
  if (PLACEHOLDER_SECRET.test(configured)) {
    return "AUTH_SECRET still looks like a placeholder (e.g. 'change-me')";
  }
  return null;
}

/**
 * Called from `instrumentation.ts` so a misconfigured production server refuses
 * to start, rather than booting and failing every session-dependent request.
 */
export function assertProductionConfig(): void {
  if (!isProductionRuntime()) return;
  const problem = authSecretProblem(process.env.AUTH_SECRET);
  if (problem) {
    throw new Error(
      `${problem}. Generate a real one with: openssl rand -base64 32 (32+ random characters).`
    );
  }
}

/**
 * Why outbound email cannot be delivered, or null if it can.
 *
 * Kept separate from `assertProductionConfig` because it must not be fatal. A
 * deploy without a mail provider is a legitimate state — anonymous audits and
 * paid traffic work fine without it — and refusing to boot would block a
 * release over a missing integration. But it is also the difference between
 * "password reset works" and "every user who forgot their password is locked
 * out and never told why", so it has to be loud rather than silent.
 */
export function emailDeliveryProblem(): string | null {
  if (!isProductionRuntime()) return null;
  const url = process.env.EMAIL_WEBHOOK_URL?.trim();
  if (!url) {
    return "EMAIL_WEBHOOK_URL is not set, so password reset and email verification cannot be delivered";
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") {
      return "EMAIL_WEBHOOK_URL is not https, so credentials would cross the network in clear text";
    }
  } catch {
    return "EMAIL_WEBHOOK_URL is not a valid URL";
  }
  return null;
}

/**
 * Non-fatal configuration problems, for logging at boot and for surfacing on
 * the admin status endpoint. Empty outside production, so development and test
 * runs are not nagged.
 */
export function productionConfigWarnings(): string[] {
  if (!isProductionRuntime()) return [];
  const warnings: string[] = [];
  const email = emailDeliveryProblem();
  if (email) warnings.push(email);
  if (!process.env.BACKUP_PASSPHRASE?.trim()) {
    warnings.push(
      "BACKUP_PASSPHRASE is not set, so npm run db:backup will write plaintext snapshots"
    );
  }
  // A missing site URL is not cosmetic: it puts localhost in the canonical tags,
  // sitemap and robots.txt, and stops password-reset emails being sent at all.
  const site = siteUrlProblem(process.env, { production: true });
  if (site) warnings.push(site);
  return warnings;
}
